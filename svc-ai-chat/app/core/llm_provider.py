"""Multi-provider LLM factory for stateless AI services.

Provider selection: LLM_PROVIDER env var, or fetched from svc-admin settings.
Supported: openai, anthropic, gemini.
"""
import os
import logging

from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

_cached_settings: dict | None = None


async def fetch_ai_settings() -> dict | None:
    """Fetch AI settings from svc-admin via internal API (cached after first call)."""
    global _cached_settings
    if _cached_settings is not None:
        return _cached_settings
    try:
        import httpx

        async with httpx.AsyncClient() as client:
            r = await client.get("http://localhost:8003/api/settings/ai-provider", timeout=5)
            if r.status_code == 200:
                _cached_settings = r.json()
                return _cached_settings
    except Exception:
        pass
    return None


def get_llm(temperature: float = 0.3, model: str = None):
    """Return a LangChain chat model based on env or admin settings."""
    provider = os.getenv("LLM_PROVIDER", "openai")

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=model or os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
            api_key=os.getenv("ANTHROPIC_API_KEY", ""),
            temperature=temperature,
        )

    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=model or os.getenv("GOOGLE_MODEL", "gemini-2.0-flash"),
            google_api_key=os.getenv("GOOGLE_API_KEY", ""),
            temperature=temperature,
        )

    # Default: OpenAI
    return ChatOpenAI(
        model=model or os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        api_key=os.getenv("OPENAI_API_KEY", ""),
        temperature=temperature,
    )
