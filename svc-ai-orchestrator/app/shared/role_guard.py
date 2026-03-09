"""Role-based tool access control."""

# Tools accessible per role
ROLE_TOOL_ACCESS = {
    "admin": {
        "create_job_posting",
        "move_candidate_stage",
        "add_candidates_to_job",
        "schedule_interview",
        "create_offer",
        "update_job_status",
        "search_candidates",
        "add_candidate_to_talent_pool",
        "get_job_candidates",
        "web_search",
    },
    "hr": {
        "create_job_posting",
        "move_candidate_stage",
        "add_candidates_to_job",
        "schedule_interview",
        "create_offer",
        "update_job_status",
        "search_candidates",
        "add_candidate_to_talent_pool",
        "get_job_candidates",
        "web_search",
    },
    "hiring_manager": {
        "move_candidate_stage",
        "add_candidates_to_job",
        "schedule_interview",
        "create_offer",
        "search_candidates",
        "add_candidate_to_talent_pool",
        "get_job_candidates",
        "web_search",
    },
    "interviewer": {
        "search_candidates",
        "get_job_candidates",
        "web_search",
    },
    "recruiter": {
        "search_candidates",
        "web_search",
    },
}


def get_allowed_tools(user_role: str) -> set[str]:
    """Return the set of tool names a user role has access to."""
    return ROLE_TOOL_ACCESS.get(user_role, set())


def filter_tools_for_role(tools: list[dict], user_role: str) -> list[dict]:
    """Filter OpenAI-format tool definitions by user role."""
    allowed = get_allowed_tools(user_role)
    return [t for t in tools if t.get("function", {}).get("name") in allowed]
