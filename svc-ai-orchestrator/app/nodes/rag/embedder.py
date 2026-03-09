"""RAG node: embed query using AI service."""
import logging

from app.core.http_client import get_ai_client
from app.core.config import settings
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("embed_query", "llm_call")
async def embed_query_node(state: dict) -> dict:
    """Call svc-ai-chat to embed the user query."""
    query = state.get("query", "")
    if not query:
        return {"error": "No query provided"}

    try:
        client = get_ai_client()
        resp = await client.post(
            f"{settings.AI_CHAT_URL}/chat/embed-query",
            json={"text": query},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {"query_embedding": data.get("embedding"), "error": None}
        else:
            return {"error": f"Query embedding failed: {resp.status_code}"}
    except Exception as e:
        logger.exception("Query embedding error")
        return {"error": str(e)}
