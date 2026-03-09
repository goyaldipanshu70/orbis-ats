"""Pydantic output parser for structured LLM responses."""
import json
import re
import logging
from typing import TypeVar, Type, Optional

from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


def parse_structured_output(text: str, model_class: Type[T]) -> Optional[T]:
    """Attempt to parse JSON from LLM output into a Pydantic model."""
    # Try direct JSON parse first
    try:
        data = json.loads(text)
        return model_class.model_validate(data)
    except (json.JSONDecodeError, ValidationError):
        pass

    # Try to extract JSON from markdown code blocks
    json_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group(1))
            return model_class.model_validate(data)
        except (json.JSONDecodeError, ValidationError):
            pass

    # Try to find any JSON object in the text
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        try:
            data = json.loads(brace_match.group(0))
            return model_class.model_validate(data)
        except (json.JSONDecodeError, ValidationError):
            pass

    logger.warning("Failed to parse structured output from LLM response")
    return None


def extract_structured_tag(text: str) -> Optional[dict]:
    """Extract <!--STRUCTURED:{...}--> data from assistant response."""
    match = re.search(r"<!--STRUCTURED:(.*?)-->", text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    return None


def strip_structured_tag(text: str) -> str:
    """Remove <!--STRUCTURED:{...}--> tags from text."""
    return re.sub(r"\s*<!--STRUCTURED:.*?-->\s*", "", text).strip()
