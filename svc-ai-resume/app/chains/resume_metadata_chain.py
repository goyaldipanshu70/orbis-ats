from pathlib import Path
from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.core.llm_provider import get_llm
from app.schemas.resume_schema import ResumeMetadataExtractOutput

RESUME_METADATA_PROMPT_PATH = Path("app/prompts/resume_metadata_prompt.txt")


def run_resume_metadata_chain(resume_text: str) -> dict:
    """Extract metadata from resume text without any JD comparison."""
    prompt_str = RESUME_METADATA_PROMPT_PATH.read_text()

    prompt = PromptTemplate(
        input_variables=["resume_text"],
        template=prompt_str,
    )

    llm = get_llm(temperature=0.1)
    parser = JsonOutputParser(pydantic_object=ResumeMetadataExtractOutput)
    chain = prompt | llm | parser

    try:
        result = chain.invoke({"resume_text": resume_text})

        # Sync flat link fields from nested links object for backward compat
        links = result.get("links") or {}
        for field in ("linkedin_url", "github_url", "portfolio_url"):
            if not result.get(field) and links.get(field):
                result[field] = links[field]
            elif result.get(field) and not links.get(field):
                if not isinstance(links, dict):
                    links = {}
                links[field] = result[field]
                result["links"] = links

        return result
    except Exception as e:
        print(f"Resume metadata extraction failed: {e}")
        raise e
