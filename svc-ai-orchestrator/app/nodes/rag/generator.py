"""RAG node: generate answer using context and LLM."""
import logging

from app.core.http_client import get_ai_client
from app.core.config import settings
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("generate_answer", "llm_call")
async def generate_answer_node(state: dict) -> dict:
    """Call svc-ai-chat RAG endpoint to generate an answer with context."""
    query = state.get("query", "")
    context_text = state.get("context_text", "")

    if not context_text:
        return {"answer": "No relevant documents found to answer your question.", "error": None}

    try:
        client = get_ai_client()
        resp = await client.post(
            f"{settings.AI_CHAT_URL}/chat/rag",
            json={
                "query": query,
                "context": context_text,
                "history": state.get("history", []),
            },
            timeout=60,
        )
        if resp.status_code == 200:
            data = resp.json()
            # Build sources from reranked chunks
            sources = []
            for chunk in (state.get("reranked_chunks") or [])[:5]:
                sources.append({
                    "document": chunk.get("source", "Unknown"),
                    "page": chunk.get("page"),
                    "score": chunk.get("score"),
                })

            return {
                "answer": data.get("answer", ""),
                "sources": sources,
                "error": None,
            }
        else:
            return {"error": f"RAG generation failed: {resp.status_code}"}
    except Exception as e:
        logger.exception("RAG generation error")
        return {"error": str(e)}
