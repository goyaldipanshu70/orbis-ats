"""Tavily web search tool wrapper."""
from app.core.config import settings


async def web_search(query: str, max_results: int = 5) -> dict:
    """Execute a web search via Tavily."""
    if not settings.TAVILY_API_KEY:
        return {"success": False, "error": "TAVILY_API_KEY not configured"}

    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        result = client.search(query=query, max_results=max_results)
        results = []
        for r in result.get("results", []):
            results.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", "")[:500],
            })
        return {"success": True, "results": results}
    except Exception as e:
        return {"success": False, "error": str(e)}
