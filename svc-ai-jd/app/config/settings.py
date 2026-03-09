import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

OPENAI_MODEL = "gpt-3.5-turbo"
OPENAI_TEMP = 0.7
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

JD_ROLE_MATCH_PROMPT_PATH = Path("app/prompts/jd_role_match_prompt.txt")
JD_RUBRIC_EXTRACTION_PROMPT_PATH = Path("app/prompts/jd_rubric_extraction_prompt.txt")
