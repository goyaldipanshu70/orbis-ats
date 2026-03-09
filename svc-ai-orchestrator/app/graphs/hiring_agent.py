"""LangGraph state machine for the Hiring Agent.

Flow:
  START → gather_context → planner → should_continue?
    ├─ tool_calls → tool_executor → planner (loop)
    ├─ done → finalizer → END
    └─ max_iterations → finalizer → END
"""
import logging

from langgraph.graph import StateGraph, END

from app.schemas.agent_state import HiringAgentState
from app.nodes.hiring.context_gatherer import gather_context_node
from app.nodes.hiring.planner import planner_node
from app.nodes.hiring.tool_executor import tool_executor_node
from app.nodes.hiring.finalizer import finalizer_node

logger = logging.getLogger(__name__)


def _should_continue(state: HiringAgentState) -> str:
    """Conditional edge: decide whether to execute tools, finalize, or stop."""
    # Check max iterations
    if state.get("iteration_count", 0) >= state.get("max_iterations", 5):
        logger.info("Max iterations reached, finalizing")
        return "finalize"

    # Check if last message has tool calls
    messages = state.get("messages", [])
    if messages:
        last = messages[-1]
        tool_calls = getattr(last, "tool_calls", None)
        if tool_calls:
            return "execute_tools"

    return "finalize"


def build_hiring_agent_graph() -> StateGraph:
    """Build and compile the hiring agent LangGraph."""
    graph = StateGraph(HiringAgentState)

    # Add nodes
    graph.add_node("gather_context", gather_context_node)
    graph.add_node("planner", planner_node)
    graph.add_node("tool_executor", tool_executor_node)
    graph.add_node("finalizer", finalizer_node)

    # Set entry point
    graph.set_entry_point("gather_context")

    # Edges
    graph.add_edge("gather_context", "planner")

    # Conditional: after planner, decide next step
    graph.add_conditional_edges(
        "planner",
        _should_continue,
        {
            "execute_tools": "tool_executor",
            "finalize": "finalizer",
        },
    )

    # After tool execution, go back to planner
    graph.add_edge("tool_executor", "planner")

    # Finalizer goes to END
    graph.add_edge("finalizer", END)

    return graph.compile()


# Compiled graph singleton
hiring_agent_graph = build_hiring_agent_graph()
