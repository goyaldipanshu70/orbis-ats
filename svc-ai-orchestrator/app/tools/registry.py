"""Tool registry with role-based access control for LangChain tool-calling."""
from langchain_core.tools import tool
from app.shared.role_guard import filter_tools_for_role

# OpenAI-format tool definitions (same as svc-recruiting hiring_agent_service)
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "create_job_posting",
            "description": "Create a new job posting. Use this when the user asks to create/post a new job.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_title": {"type": "string", "description": "The job title"},
                    "summary": {"type": "string", "description": "Brief job description/summary"},
                    "core_skills": {"type": "array", "items": {"type": "string"}, "description": "List of core/required skills"},
                    "preferred_skills": {"type": "array", "items": {"type": "string"}, "description": "List of preferred/nice-to-have skills"},
                    "min_experience_years": {"type": "integer", "description": "Minimum years of experience required"},
                    "education": {"type": "string", "description": "Education requirement"},
                    "number_of_vacancies": {"type": "integer", "description": "Number of open positions", "default": 1},
                    "country": {"type": "string", "description": "Country where the job is located"},
                    "city": {"type": "string", "description": "City where the job is located"},
                },
                "required": ["job_title", "summary", "core_skills", "country", "city"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "move_candidate_stage",
            "description": "Move a candidate to a different pipeline stage. Valid stages: applied, screening, interview, offer, hired, rejected.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_id": {"type": "integer", "description": "The candidate's ID"},
                    "stage": {"type": "string", "enum": ["applied", "screening", "interview", "offer", "hired", "rejected"], "description": "The target pipeline stage"},
                    "notes": {"type": "string", "description": "Optional notes for the stage change"},
                },
                "required": ["candidate_id", "stage"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_candidates_to_job",
            "description": "Import/add existing candidates to a different job posting.",
            "parameters": {
                "type": "object",
                "properties": {
                    "target_job_id": {"type": "integer", "description": "The job ID to add candidates to"},
                    "candidate_ids": {"type": "array", "items": {"type": "integer"}, "description": "List of candidate IDs to import"},
                },
                "required": ["target_job_id", "candidate_ids"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_interview",
            "description": "Schedule an interview for a candidate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_id": {"type": "integer", "description": "The candidate's ID"},
                    "jd_id": {"type": "integer", "description": "The job ID"},
                    "interview_type": {"type": "string", "enum": ["phone", "video", "in_person"], "description": "Type of interview", "default": "video"},
                    "scheduled_date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                    "scheduled_time": {"type": "string", "description": "Time in HH:MM format (24h)"},
                    "duration_minutes": {"type": "integer", "description": "Duration in minutes", "default": 60},
                    "interviewer_names": {"type": "array", "items": {"type": "string"}, "description": "Names of interviewers"},
                    "location": {"type": "string", "description": "Location or meeting link"},
                    "notes": {"type": "string", "description": "Additional notes"},
                },
                "required": ["candidate_id", "jd_id", "scheduled_date", "scheduled_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_offer",
            "description": "Create a job offer for a candidate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_id": {"type": "integer", "description": "The candidate's ID"},
                    "jd_id": {"type": "integer", "description": "The job ID"},
                    "salary": {"type": "number", "description": "Salary amount"},
                    "salary_currency": {"type": "string", "description": "Currency code (e.g. USD)", "default": "USD"},
                    "position_title": {"type": "string", "description": "Job title on the offer"},
                    "start_date": {"type": "string", "description": "Start date in YYYY-MM-DD format"},
                    "department": {"type": "string", "description": "Department name"},
                },
                "required": ["candidate_id", "jd_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_job_status",
            "description": "Update a job posting's status (Open or Closed).",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {"type": "integer", "description": "The job ID"},
                    "status": {"type": "string", "enum": ["Open", "Closed"], "description": "The new status"},
                },
                "required": ["job_id", "status"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_candidates",
            "description": "Search the talent pool for candidates matching criteria.",
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "Search query (name, email, skills)"},
                    "min_experience": {"type": "integer", "description": "Minimum years of experience"},
                    "max_experience": {"type": "integer", "description": "Maximum years of experience"},
                    "category": {"type": "string", "description": "Filter by recommendation category"},
                },
                "required": [],
            },
        },
    },
]

WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the web for current information (salary data, market trends, etc). Only use when the user explicitly asks for web/internet information.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
            },
            "required": ["query"],
        },
    },
}


def get_tools_for_role(user_role: str, web_search_enabled: bool = False) -> list[dict]:
    """Return tool definitions filtered by user role."""
    tools = list(TOOL_DEFINITIONS)
    if web_search_enabled:
        tools.append(WEB_SEARCH_TOOL)
    return filter_tools_for_role(tools, user_role)
