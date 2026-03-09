"""RAG node: rerank retrieved chunks for better relevance."""
import logging

from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("rerank", "decision")
async def rerank_node(state: dict) -> dict:
    """Rerank retrieved chunks by relevance score. Currently passes through."""
    chunks = state.get("retrieved_chunks", [])
    if not chunks:
        return {"reranked_chunks": [], "context_text": ""}

    # Sort by score (descending) if available
    sorted_chunks = sorted(chunks, key=lambda c: c.get("score", 0), reverse=True)

    # Build context text from top chunks
    context_parts = []
    for i, chunk in enumerate(sorted_chunks[:state.get("top_k", 5)]):
        source = chunk.get("source", "Unknown")
        text = chunk.get("text", "")
        context_parts.append(f"[Source: {source}]\n{text}")

    context_text = "\n\n---\n\n".join(context_parts)

    return {
        "reranked_chunks": sorted_chunks,
        "context_text": context_text,
        "error": None,
    }
