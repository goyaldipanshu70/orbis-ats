from datetime import datetime
from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.core.llm_provider import get_llm
from app.schemas.resume_schema import ResumeAnalyzerOutput
from app.config.settings import OPENAI_TEMP, RESUME_ANALYSIS_PROMPT_PATH

def run_resume_analysis_chain(resume_text: str, parsed_jd: dict, rubric_text: str) -> dict:
    """
    Analyzes resume using job description and rubric.
    Returns structured feedback and scoring.
    """
    prompt_str = RESUME_ANALYSIS_PROMPT_PATH.read_text()

    prompt = PromptTemplate(
        input_variables=["resume_text", "parsed_jd", "rubric_text", "date"],
        template=prompt_str
    )

    llm = get_llm(temperature=OPENAI_TEMP)
    parser = JsonOutputParser(pydantic_object=ResumeAnalyzerOutput)
    chain = prompt | llm | parser

    today = datetime.now().strftime("%B %Y")

    try:
        return chain.invoke({
            "resume_text": resume_text,
            "parsed_jd": parsed_jd,
            "rubric_text": rubric_text or "",
            "date": today
        })
    except Exception as e:
        print(f"Resume analysis chain failed: {e}")
        raise e
