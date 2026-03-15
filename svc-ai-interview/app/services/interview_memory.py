"""Interview memory using embeddings for long conversation context.

Maintains a semantic memory of the interview conversation, allowing the
AI interviewer to reference earlier answers and detect contradictions
across long interviews.

Uses OpenAI embeddings for similarity search. Falls back to simple
recency-based context if embeddings are unavailable.
"""
import json
import logging
import os
from typing import List, Optional

import numpy as np

logger = logging.getLogger("svc-ai-interview")


def _get_embedding(text: str) -> Optional[List[float]]:
    """Get embedding vector for a text chunk using OpenAI."""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text[:8000],  # Truncate to stay within limits
        )
        return response.data[0].embedding
    except Exception as e:
        logger.warning("Embedding generation failed: %s", e)
        return None


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a_arr = np.array(a)
    b_arr = np.array(b)
    norm_a = np.linalg.norm(a_arr)
    norm_b = np.linalg.norm(b_arr)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a_arr, b_arr) / (norm_a * norm_b))


class InterviewMemory:
    """Manages conversation memory for an AI interview session.

    Stores conversation chunks with their embeddings and allows
    semantic retrieval of relevant earlier context.
    """

    def __init__(self, max_chunks: int = 100):
        self.chunks: List[dict] = []
        self.max_chunks = max_chunks

    def add_exchange(
        self,
        question: str,
        answer: str,
        question_number: int,
        round_type: str = "",
        topic: str = "",
    ) -> None:
        """Add a question-answer exchange to memory."""
        combined = f"Q: {question}\nA: {answer}"
        embedding = _get_embedding(combined)

        chunk = {
            "question": question,
            "answer": answer,
            "question_number": question_number,
            "round_type": round_type,
            "topic": topic,
            "text": combined,
            "embedding": embedding,
        }
        self.chunks.append(chunk)

        # Trim if over limit
        if len(self.chunks) > self.max_chunks:
            self.chunks = self.chunks[-self.max_chunks:]

    def get_relevant_context(
        self,
        query: str,
        top_k: int = 3,
        min_similarity: float = 0.3,
    ) -> List[dict]:
        """Retrieve the most relevant earlier exchanges for a given query.

        Used to provide the AI interviewer with context about earlier answers
        when formulating follow-up questions or detecting contradictions.
        """
        if not self.chunks:
            return []

        query_embedding = _get_embedding(query)
        if not query_embedding:
            # Fallback: return last N exchanges
            return self.chunks[-top_k:]

        # Score all chunks by similarity
        scored = []
        for chunk in self.chunks:
            if chunk["embedding"]:
                sim = _cosine_similarity(query_embedding, chunk["embedding"])
                if sim >= min_similarity:
                    scored.append((sim, chunk))

        # Sort by similarity descending
        scored.sort(key=lambda x: x[0], reverse=True)

        return [chunk for _, chunk in scored[:top_k]]

    def get_topics_covered(self) -> List[str]:
        """Return all topics covered so far."""
        return [c["topic"] for c in self.chunks if c.get("topic")]

    def get_summary(self) -> str:
        """Generate a text summary of the interview memory for context injection."""
        if not self.chunks:
            return "No previous exchanges recorded."

        lines = []
        for c in self.chunks:
            topic = f" [{c['topic']}]" if c.get("topic") else ""
            lines.append(f"Q{c['question_number']}{topic}: {c['question'][:100]}")
            lines.append(f"  A: {c['answer'][:150]}")
        return "\n".join(lines)

    def detect_contradictions(self, new_answer: str, topic: str) -> List[str]:
        """Check if the new answer contradicts earlier statements on the same topic.

        Returns a list of contradiction descriptions (empty if none found).
        """
        if not topic or len(self.chunks) < 2:
            return []

        # Find earlier exchanges on the same topic
        relevant = [c for c in self.chunks if c.get("topic", "").lower() == topic.lower()]
        if not relevant:
            return []

        # Use embedding similarity to find potentially contradictory content
        new_embedding = _get_embedding(new_answer)
        if not new_embedding:
            return []

        contradictions = []
        for chunk in relevant:
            if chunk["embedding"]:
                sim = _cosine_similarity(new_embedding, chunk["embedding"])
                # Low similarity on same topic might indicate contradiction
                if sim < 0.2 and len(chunk["answer"]) > 50 and len(new_answer) > 50:
                    contradictions.append(
                        f"Potential inconsistency with Q{chunk['question_number']} "
                        f"about {topic}: earlier answer discussed different aspects"
                    )

        return contradictions

    def to_dict(self) -> dict:
        """Serialize memory state (without embeddings for storage)."""
        return {
            "chunks": [
                {
                    "question": c["question"],
                    "answer": c["answer"],
                    "question_number": c["question_number"],
                    "round_type": c.get("round_type", ""),
                    "topic": c.get("topic", ""),
                }
                for c in self.chunks
            ],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "InterviewMemory":
        """Restore memory from serialized state."""
        memory = cls()
        for chunk in data.get("chunks", []):
            memory.add_exchange(
                question=chunk["question"],
                answer=chunk["answer"],
                question_number=chunk["question_number"],
                round_type=chunk.get("round_type", ""),
                topic=chunk.get("topic", ""),
            )
        return memory

    @classmethod
    def from_transcript(cls, transcript: list) -> "InterviewMemory":
        """Build memory from an existing transcript."""
        memory = cls()
        question_num = 0
        last_question = ""

        for entry in transcript:
            role = entry.get("role", "")
            content = entry.get("content", "")
            msg_type = entry.get("message_type", "")

            if role == "ai" and msg_type in ("question", "follow_up"):
                last_question = content
                question_num += 1
            elif role == "candidate" and last_question:
                memory.add_exchange(
                    question=last_question,
                    answer=content,
                    question_number=question_num,
                    round_type=entry.get("round_type", ""),
                    topic=entry.get("topic", ""),
                )
                last_question = ""

        return memory
