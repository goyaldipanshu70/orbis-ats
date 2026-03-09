from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings


def get_llm(provider: str = None, temperature: float = 0.3, streaming: bool = False):
    """Return a LangChain chat model for the requested provider."""
    p = provider or settings.DEFAULT_LLM_PROVIDER
    if p == "anthropic":
        return ChatAnthropic(
            model=settings.ANTHROPIC_MODEL,
            api_key=settings.ANTHROPIC_API_KEY,
            temperature=temperature,
            streaming=streaming,
        )
    if p == "gemini":
        return ChatGoogleGenerativeAI(
            model=settings.GOOGLE_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=temperature,
            streaming=streaming,
        )
    return ChatOpenAI(
        model=settings.OPENAI_MODEL,
        api_key=settings.OPENAI_API_KEY,
        temperature=temperature,
        streaming=streaming,
    )


def get_llm_for_workflow(workflow: str, **kwargs):
    """Get the LLM configured for a specific workflow."""
    overrides = {
        "hiring_agent": settings.HIRING_AGENT_PROVIDER,
        "resume_scoring": settings.RESUME_SCORING_PROVIDER,
        "interview_eval": settings.INTERVIEW_EVAL_PROVIDER,
        "rag": settings.RAG_PROVIDER,
        "lead_generation": settings.LEAD_GEN_PROVIDER,
    }
    provider = overrides.get(workflow) or None
    return get_llm(provider=provider, **kwargs)
