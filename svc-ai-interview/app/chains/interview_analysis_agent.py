import json
from datetime import datetime
from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.core.llm_provider import get_llm
from app.schemas.interview_schema import InterviewAnalyzerOutput
from app.config.settings import (
    OPENAI_TEMP,
    INTERVIEW_ANALYSIS_PROMPT_PATH
)

def run_interview_analysis_chain(
    transcript_text: str,
    parsed_jd: dict,
    parsed_resume: dict,
    rubric_text: str,
    model_answer: str
) -> dict:
    """
    Analyzes the interview transcript using job/resume context, rubric, and model answer.
    Returns a structured evaluation with score breakdown and recommendation.
    """

    # Load prompt from file
    prompt_template = INTERVIEW_ANALYSIS_PROMPT_PATH.read_text()

    # Create the prompt
    prompt = PromptTemplate(
        input_variables=[
            "transcript_text",
            "parsed_jd",
            "parsed_resume",
            "rubric_text",
            "model_answer",
            "date"
        ],
        template=prompt_template
    )

    llm = get_llm(temperature=OPENAI_TEMP)
    parser = JsonOutputParser(pydantic_object=InterviewAnalyzerOutput)

    # Chain: prompt -> LLM
    chain = prompt | llm | parser

    # Current date for scoring logic
    today = datetime.now().strftime("%B %Y")

    # Invoke chain
    try:
        return chain.invoke({
            "transcript_text": transcript_text,
            "parsed_jd": json.dumps(parsed_jd),
            "parsed_resume": json.dumps(parsed_resume),
            "rubric_text": rubric_text,
            "model_answer": model_answer,
            "date": today
        })
    except Exception as e:
        print("Interview analysis chain failed:", e)
        raise e
