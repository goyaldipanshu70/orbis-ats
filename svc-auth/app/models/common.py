from enum import Enum

class Role(str, Enum):
    ADMIN = "admin"
    HR = "hr"
    HIRING_MANAGER = "hiring_manager"
    INTERVIEWER = "interviewer"
    CANDIDATE = "candidate"
    MANAGER = "manager"  # Department Manager