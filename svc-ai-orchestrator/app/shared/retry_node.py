"""Generic retry wrapper for LangGraph nodes."""
import logging

logger = logging.getLogger(__name__)


def should_retry(state: dict, max_retries: int = 3) -> str:
    """Conditional edge: route to 'retry' or 'continue' based on retry_count."""
    if state.get("error") and state.get("retry_count", 0) < max_retries:
        return "retry"
    return "continue"


def increment_retry(state: dict) -> dict:
    """Increment retry counter and clear the error for the next attempt."""
    return {
        "retry_count": state.get("retry_count", 0) + 1,
        "error": None,
    }
