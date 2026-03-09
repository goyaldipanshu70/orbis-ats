import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

OPENAI_MODEL = "gpt-3.5-turbo"
OPENAI_TEMP = 0.7
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

RESUME_ANALYSIS_PROMPT_PATH = Path("app/prompts/resume_analysis_prompt.txt")
