"""Hiring agent node: gather DB context from recruiting_db."""
import logging

from app.tools.hiring_tools import gather_context
from app.db.postgres import _RecruitingSessionLocal
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("gather_context", "data_load")
async def gather_context_node(state: dict) -> dict:
    """Query recruiting_db for jobs, candidates, evaluations, offers."""
    if _RecruitingSessionLocal is None:
        return {"db_context": "No recruiting database configured.", "error": None}

    async with _RecruitingSessionLocal() as db:
        context = await gather_context(db, state["user_id"])

    return {"db_context": context, "error": None}
