"""RAG node: retrieve relevant chunks from vector store."""
import logging

from app.core.http_client import get_ai_client
from app.core.config import settings
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("vector_search", "data_load")
async def vector_search_node(state: dict) -> dict:
    """Search for relevant document chunks using the query embedding."""
    embedding = state.get("query_embedding")
    if not embedding:
        return {"error": "No query embedding available"}

    try:
        client = get_ai_client()
        resp = await client.post(
            f"{settings.AI_CHAT_URL}/chat/vector-search",
            json={
                "embedding": embedding,
                "top_k": state.get("top_k", 5),
                "department_ids": state.get("department_ids"),
            },
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            chunks = data.get("chunks", [])
            return {"retrieved_chunks": chunks, "error": None}
        else:
            return {"error": f"Vector search failed: {resp.status_code}"}
    except Exception as e:
        logger.exception("Vector search error")
        return {"error": str(e)}
