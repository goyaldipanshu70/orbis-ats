import json
from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.core.llm_provider import get_llm
from app.config.settings import (
    OPENAI_TEMP,
    JD_ROLE_MATCH_PROMPT_PATH,
    JD_RUBRIC_EXTRACTION_PROMPT_PATH
)
from app.schemas.jd_schema import JobDescriptionNEROutput, ExtractedRubric

def run_role_match_and_summary_chain(jd_text: str) -> dict:
    """
    Step 2 + 4 Chain: Role Matching + Summary Generation
    Takes JD and optionally rubric text as input.
    Returns role classification and JD summary.
    """
    prompt_str = JD_ROLE_MATCH_PROMPT_PATH.read_text()
    prompt = PromptTemplate(
        input_variables=["jd_text", "rubric_text"],
        template=prompt_str
    )

    llm = get_llm(temperature=OPENAI_TEMP)
    parser = JsonOutputParser(pydantic_object=JobDescriptionNEROutput)
    chain = prompt | llm | parser

    try:
        return chain.invoke({"jd_text": jd_text, "rubric_text": ""})
    except Exception as e:
        print(f"Unexpected error in role match chain: {e}")
        raise e


def run_rubric_extraction_chain(jd_text: str) -> dict:
    """
    Step 3 Chain: Extract rubric components from JD
    Returns structured rubric (skills, experience, education, etc.)
    """
    prompt_str = JD_RUBRIC_EXTRACTION_PROMPT_PATH.read_text()
    prompt = PromptTemplate(
        input_variables=["jd_text"],
        template=prompt_str
    )

    llm = get_llm(temperature=OPENAI_TEMP)
    parser = JsonOutputParser(pydantic_object=ExtractedRubric)
    chain = prompt | llm | parser

    try:
        return chain.invoke({"jd_text": jd_text})
    except Exception as e:
        print(f"Unexpected error in rubric extraction chain: {e}")
        raise e
