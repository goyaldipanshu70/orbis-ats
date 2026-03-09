"""Core AI conversation logic for live AI interviews — multi-provider."""
import json
import logging
import os
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Optional

logger = logging.getLogger("svc-ai-interview")

INTERVIEWER_PROMPT_PATH = Path("app/prompts/interviewer_system_prompt.txt")
EVALUATION_PROMPT_PATH = Path("app/prompts/evaluation_prompt.txt")


def _load_prompt(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _get_provider() -> str:
    return os.getenv("LLM_PROVIDER", "openai")


def _get_openai_client():
    from openai import OpenAI
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))


def _get_anthropic_client():
    import anthropic
    return anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))


def _get_gemini_model(model_name: str = None):
    import google.generativeai as genai
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY", ""))
    return genai.GenerativeModel(model_name or os.getenv("GOOGLE_MODEL", "gemini-2.0-flash"))


def _get_model_name() -> str:
    provider = _get_provider()
    if provider == "anthropic":
        return os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    if provider == "gemini":
        return os.getenv("GOOGLE_MODEL", "gemini-2.0-flash")
    return os.getenv("OPENAI_MODEL", "gpt-4o-mini")


# ---------------------------------------------------------------------------
# OpenAI implementations
# ---------------------------------------------------------------------------

def _openai_chat(messages: list, temperature: float = 0.7, json_mode: bool = False) -> str:
    client = _get_openai_client()
    kwargs = {
        "model": _get_model_name(),
        "messages": messages,
        "temperature": temperature,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    response = client.chat.completions.create(**kwargs)
    return response.choices[0].message.content


def _openai_chat_stream(messages: list, temperature: float = 0.7):
    client = _get_openai_client()
    return client.chat.completions.create(
        model=_get_model_name(),
        messages=messages,
        temperature=temperature,
        stream=True,
    )


# ---------------------------------------------------------------------------
# Anthropic implementations
# ---------------------------------------------------------------------------

def _anthropic_chat(messages: list, temperature: float = 0.7) -> str:
    client = _get_anthropic_client()
    # Convert OpenAI-style messages to Anthropic format
    system_text = ""
    user_msgs = []
    for m in messages:
        if m["role"] == "system":
            system_text += m["content"] + "\n"
        else:
            user_msgs.append(m)
    if not user_msgs:
        user_msgs = [{"role": "user", "content": "..."}]
    response = client.messages.create(
        model=_get_model_name(),
        max_tokens=4096,
        system=system_text.strip(),
        messages=user_msgs,
        temperature=temperature,
    )
    return response.content[0].text


# ---------------------------------------------------------------------------
# Gemini implementations
# ---------------------------------------------------------------------------

def _gemini_chat(messages: list, temperature: float = 0.7) -> str:
    model = _get_gemini_model()
    # Flatten messages into a single prompt
    prompt_parts = []
    for m in messages:
        role = m["role"].upper()
        prompt_parts.append(f"[{role}]: {m['content']}")
    prompt = "\n\n".join(prompt_parts)
    response = model.generate_content(
        prompt,
        generation_config={"temperature": temperature},
    )
    return response.text


# ---------------------------------------------------------------------------
# Unified dispatch
# ---------------------------------------------------------------------------

def _chat_completion(messages: list, temperature: float = 0.7, json_mode: bool = False) -> str:
    provider = _get_provider()
    if provider == "anthropic":
        return _anthropic_chat(messages, temperature)
    if provider == "gemini":
        return _gemini_chat(messages, temperature)
    return _openai_chat(messages, temperature, json_mode)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_question_plan(
    parsed_jd: dict,
    parsed_resume: dict,
    interview_type: str,
    include_coding: bool,
    coding_language: Optional[str],
    max_questions: int,
) -> dict:
    """Generate a structured question plan based on JD + resume."""
    type_mix = {
        "behavioral": {"behavioral": 50, "technical": 20, "problem_solving": 20, "culture_fit": 10},
        "technical": {"technical": 50, "problem_solving": 25, "behavioral": 15, "culture_fit": 10},
        "mixed": {"technical": 40, "behavioral": 30, "problem_solving": 20, "culture_fit": 10},
    }
    mix = type_mix.get(interview_type, type_mix["mixed"])

    system_prompt = f"""You are an expert interview designer. Create a structured interview question plan.

Job Description: {json.dumps(parsed_jd, default=str)}

Candidate Resume: {json.dumps(parsed_resume, default=str)}

Requirements:
- Generate exactly {max_questions} questions
- Question type distribution: {json.dumps(mix)}
- Each question should be specific to this role and candidate
- Reference the candidate's actual experience where possible
- {"Include 1-2 coding challenges in " + (coding_language or "Python") if include_coding else "No coding challenges"}
- Order: Start with an easy warm-up, increase difficulty, end with culture fit

Respond with ONLY valid JSON:
{{
  "questions": [
    {{
      "question": "...",
      "type": "behavioral|technical|problem_solving|culture_fit|coding",
      "topic": "...",
      "difficulty": "easy|medium|hard",
      "follow_up_hints": ["...", "..."],
      "expected_approach": "..."
    }}
  ],
  "opening_message": "A warm, professional greeting introducing yourself as the AI interviewer and briefly explaining the interview format."
}}"""

    result = _chat_completion(
        [{"role": "system", "content": system_prompt}],
        temperature=0.7,
        json_mode=True,
    )
    return json.loads(result)


def generate_interviewer_response_stream(
    conversation_history: List[Dict[str, str]],
    current_question: int,
    questions_plan: dict,
    parsed_jd: dict,
    parsed_resume: dict,
    interview_type: str,
    max_questions: int,
) -> AsyncGenerator[str, None]:
    """Stream an interviewer response given the conversation so far."""
    system_template = _load_prompt(INTERVIEWER_PROMPT_PATH)
    system_prompt = system_template.format(
        parsed_jd=json.dumps(parsed_jd, default=str),
        parsed_resume=json.dumps(parsed_resume, default=str),
        questions_plan=json.dumps(questions_plan, default=str),
        current_question=current_question,
        max_questions=max_questions,
        interview_type=interview_type,
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(conversation_history)
    messages.append({
        "role": "system",
        "content": (
            f"You are on question {current_question} of {max_questions}. "
            "Evaluate the candidate's last answer, then either ask a follow-up or move to the next question. "
            "If this was the last question, wrap up the interview professionally. "
            "Respond with ONLY valid JSON: "
            '{"message": "your response text", "message_type": "follow_up|question|closing", '
            '"move_to_next": true/false, '
            '"code_prompt": null or {"problem": "...", "language": "...", "examples": "..."} if asking a coding question}'
        ),
    })

    # Streaming only supported for OpenAI; others fall back to non-streaming
    provider = _get_provider()
    if provider == "openai":
        return _openai_chat_stream(messages, temperature=0.7)

    # For non-OpenAI, return the full response (caller handles this)
    return _chat_completion(messages, temperature=0.7)


def generate_interviewer_response(
    conversation_history: List[Dict[str, str]],
    current_question: int,
    questions_plan: dict,
    parsed_jd: dict,
    parsed_resume: dict,
    interview_type: str,
    max_questions: int,
) -> dict:
    """Non-streaming version: get interviewer response as parsed JSON."""
    system_template = _load_prompt(INTERVIEWER_PROMPT_PATH)
    system_prompt = system_template.format(
        parsed_jd=json.dumps(parsed_jd, default=str),
        parsed_resume=json.dumps(parsed_resume, default=str),
        questions_plan=json.dumps(questions_plan, default=str),
        current_question=current_question,
        max_questions=max_questions,
        interview_type=interview_type,
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(conversation_history)
    messages.append({
        "role": "system",
        "content": (
            f"You are on question {current_question} of {max_questions}. "
            "Evaluate the candidate's last answer, then either ask a follow-up or move to the next question. "
            "If this was the last question, wrap up the interview professionally. "
            "Respond with ONLY valid JSON: "
            '{"message": "your response text", "message_type": "follow_up|question|closing", '
            '"move_to_next": true/false, '
            '"code_prompt": null or {"problem": "...", "language": "...", "examples": "..."} if asking a coding question}'
        ),
    })

    result = _chat_completion(messages, temperature=0.7, json_mode=True)
    return json.loads(result)


def generate_final_evaluation(
    transcript: list,
    parsed_jd: dict,
    parsed_resume: dict,
    questions_plan: dict,
    proctoring_summary: dict,
) -> dict:
    """Generate comprehensive evaluation from the full interview transcript."""
    eval_template = _load_prompt(EVALUATION_PROMPT_PATH)
    prompt = eval_template.format(
        transcript=json.dumps(transcript, default=str),
        parsed_jd=json.dumps(parsed_jd, default=str),
        parsed_resume=json.dumps(parsed_resume, default=str),
        questions_plan=json.dumps(questions_plan, default=str),
        proctoring_summary=json.dumps(proctoring_summary, default=str),
    )

    result = _chat_completion(
        [{"role": "system", "content": prompt}],
        temperature=0.3,
        json_mode=True,
    )
    return json.loads(result)


def evaluate_code_submission(
    code: str,
    language: str,
    problem_description: str,
    expected_approach: Optional[str] = None,
) -> dict:
    """Evaluate a code submission via LLM."""
    prompt = f"""Evaluate this code submission for an interview coding challenge.

Problem: {problem_description}
Language: {language}
Expected Approach: {expected_approach or "Not specified"}

Submitted Code:
```{language}
{code}
```

Evaluate on:
1. Correctness — does it solve the problem?
2. Efficiency — time/space complexity
3. Code quality — readability, naming, structure
4. Approach — did they use an appropriate algorithm?

Respond with ONLY valid JSON:
{{
  "score": 0-100,
  "feedback": "Brief constructive feedback",
  "passed": true/false,
  "correctness": "correct|partial|incorrect",
  "efficiency": "optimal|acceptable|suboptimal",
  "code_quality": "excellent|good|fair|poor"
}}"""

    result = _chat_completion(
        [{"role": "system", "content": prompt}],
        temperature=0.3,
        json_mode=True,
    )
    return json.loads(result)
