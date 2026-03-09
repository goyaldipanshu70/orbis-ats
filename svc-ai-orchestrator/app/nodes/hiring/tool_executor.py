"""Hiring agent node: execute tool calls from the planner."""
import json
import logging

from langchain_core.messages import ToolMessage

from app.tools.hiring_tools import TOOL_EXECUTORS, exec_web_search
from app.db.postgres import _RecruitingSessionLocal
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("tool_executor", "tool_call")
async def tool_executor_node(state: dict) -> dict:
    """Execute all pending tool calls from the last assistant message."""
    last_message = state["messages"][-1]
    tool_calls = getattr(last_message, "tool_calls", None) or []

    if not tool_calls:
        return {"messages": [], "tools_called": state.get("tools_called", [])}

    tool_messages = []
    tools_called = list(state.get("tools_called", []))

    for tc in tool_calls:
        fn_name = tc["name"]
        fn_args = tc["args"]
        tool_call_id = tc["id"]

        logger.info(f"Executing tool: {fn_name}({fn_args})")

        try:
            if fn_name == "web_search":
                result = await exec_web_search(fn_args)
            elif fn_name in TOOL_EXECUTORS:
                if _RecruitingSessionLocal is None:
                    result = {"success": False, "error": "Recruiting database not configured"}
                else:
                    async with _RecruitingSessionLocal() as db:
                        result = await TOOL_EXECUTORS[fn_name](db, state["user_id"], fn_args)
            else:
                result = {"success": False, "error": f"Unknown tool: {fn_name}"}
        except Exception as e:
            logger.exception(f"Tool execution failed: {fn_name}")
            result = {"success": False, "error": str(e)}

        tools_called.append({
            "tool": fn_name,
            "args": fn_args,
            "result": result,
        })

        tool_messages.append(
            ToolMessage(
                content=json.dumps(result, default=str),
                tool_call_id=tool_call_id,
            )
        )

    return {
        "messages": tool_messages,
        "tools_called": tools_called,
    }
