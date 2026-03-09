"""Hiring agent node: finalize the response — extract structured data and format output."""
import re
import json
import logging

from app.shared.structured_output import extract_structured_tag, strip_structured_tag
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("finalizer", "data_load")
async def finalizer_node(state: dict) -> dict:
    """Extract the final answer and any structured data from the last message."""
    last_message = state["messages"][-1]
    answer = getattr(last_message, "content", "") or ""

    # Extract structured tag (e.g., <!--STRUCTURED:{"type":"candidates","ids":[1,2,3]}-->)
    structured = extract_structured_tag(answer)
    clean_answer = strip_structured_tag(answer)

    return {
        "final_answer": clean_answer,
        "structured_data": structured,
    }
