"""Core AI conversation logic for live AI interviews — multi-provider.

Supports:
- Multi-round interview planning (screening, technical, coding, system_design, behavioral)
- Adaptive difficulty adjustment
- Conversation state tracking (topics, strengths, weaknesses)
- Deep multi-dimensional evaluation
- Recruiter report generation
"""
import json
import logging
import math
import os
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Optional

logger = logging.getLogger("svc-ai-interview")

INTERVIEWER_PROMPT_PATH = Path("app/prompts/interviewer_system_prompt.txt")
ADAPTIVE_PROMPT_PATH = Path("app/prompts/adaptive_interviewer_prompt.txt")
EVALUATION_PROMPT_PATH = Path("app/prompts/evaluation_prompt.txt")
DEEP_EVALUATION_PROMPT_PATH = Path("app/prompts/deep_evaluation_prompt.txt")


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


def _safe_parse_json(text: str) -> dict:
    """Parse JSON, stripping markdown fences if present."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines)
    return json.loads(cleaned)


# ---------------------------------------------------------------------------
# Interview Plan Generation (Multi-Round)
# ---------------------------------------------------------------------------

def _determine_rounds(
    interview_type: str,
    include_coding: bool,
    max_questions: int,
    seniority_level: str = "mid",
) -> list:
    """Determine interview round structure based on configuration."""

    if interview_type == "behavioral":
        rounds = [
            {"type": "screening", "questions": min(2, max_questions)},
            {"type": "behavioral", "questions": max(max_questions - 2, 1)},
        ]
    elif interview_type == "technical":
        tech_q = max(max_questions - 3, 2)
        rounds = [
            {"type": "screening", "questions": 2},
            {"type": "technical", "questions": tech_q},
        ]
        if include_coding:
            rounds.append({"type": "coding", "questions": 1})
    elif interview_type == "mixed":
        # Default balanced structure
        total = max_questions
        screening = min(2, total)
        remaining = total - screening

        if seniority_level in ("senior", "lead", "staff", "principal"):
            # Senior: heavier on system design and behavioral
            tech = max(math.ceil(remaining * 0.3), 1)
            sys_design = max(math.ceil(remaining * 0.25), 1)
            behavioral = max(math.ceil(remaining * 0.25), 1)
            coding = 1 if include_coding else 0
            # Adjust to fit
            allocated = tech + sys_design + behavioral + coding
            if allocated > remaining:
                behavioral = max(behavioral - (allocated - remaining), 1)
        else:
            # Junior/Mid: heavier on technical
            tech = max(math.ceil(remaining * 0.4), 1)
            sys_design = max(math.ceil(remaining * 0.15), 1) if remaining >= 6 else 0
            behavioral = max(math.ceil(remaining * 0.25), 1)
            coding = 1 if include_coding else 0
            allocated = tech + sys_design + behavioral + coding
            if allocated > remaining:
                sys_design = max(sys_design - (allocated - remaining), 0)

        rounds = [{"type": "screening", "questions": screening}]
        if tech > 0:
            rounds.append({"type": "technical", "questions": tech})
        if include_coding and coding > 0:
            rounds.append({"type": "coding", "questions": coding})
        if sys_design > 0:
            rounds.append({"type": "system_design", "questions": sys_design})
        if behavioral > 0:
            rounds.append({"type": "behavioral", "questions": behavioral})
    else:
        rounds = [{"type": interview_type, "questions": max_questions}]

    # Ensure total matches max_questions
    current_total = sum(r["questions"] for r in rounds)
    if current_total < max_questions and rounds:
        # Add remaining to the largest round
        largest = max(rounds, key=lambda r: r["questions"])
        largest["questions"] += max_questions - current_total
    elif current_total > max_questions and rounds:
        excess = current_total - max_questions
        for r in reversed(rounds):
            cut = min(excess, r["questions"] - 1)
            r["questions"] -= cut
            excess -= cut
            if excess <= 0:
                break

    return rounds


def _infer_seniority(parsed_jd: dict, parsed_resume: dict) -> str:
    """Infer seniority level from JD and resume."""
    title = ""
    if isinstance(parsed_jd, dict):
        title = (parsed_jd.get("job_title") or parsed_jd.get("title") or "").lower()
    experience_years = 0
    if isinstance(parsed_resume, dict):
        experience_years = parsed_resume.get("years_of_experience", 0) or 0

    senior_keywords = ["senior", "lead", "staff", "principal", "architect", "director", "vp", "head"]
    if any(kw in title for kw in senior_keywords) or experience_years >= 7:
        return "senior"
    if experience_years >= 3:
        return "mid"
    return "junior"


def generate_interview_plan(
    parsed_jd: dict,
    parsed_resume: dict,
    interview_type: str,
    include_coding: bool,
    coding_language: Optional[str],
    max_questions: int,
) -> dict:
    """Generate a multi-round interview plan with structured rounds."""
    seniority = _infer_seniority(parsed_jd, parsed_resume)
    rounds = _determine_rounds(interview_type, include_coding, max_questions, seniority)

    # Extract topics from JD for targeted questioning
    jd_skills = []
    if isinstance(parsed_jd, dict):
        jd_skills = parsed_jd.get("required_skills", []) or parsed_jd.get("skills", []) or []
        if isinstance(jd_skills, str):
            jd_skills = [s.strip() for s in jd_skills.split(",")]

    system_prompt = f"""You are an expert interview designer. Create a multi-round interview plan.

Job Description: {json.dumps(parsed_jd, default=str)}

Candidate Resume: {json.dumps(parsed_resume, default=str)}

Seniority Level: {seniority}

Interview Round Structure:
{json.dumps(rounds, indent=2)}

Key Skills to Assess: {json.dumps(jd_skills)}

Requirements:
- Generate questions for EACH round as specified above
- Total questions across all rounds must equal {max_questions}
- Each question belongs to a specific round
- Start each round with appropriate difficulty for that round type
- Reference the candidate's actual experience where possible
- {"Include coding challenges in " + (coding_language or "Python") + " for the coding round" if include_coding else "No coding challenges"}
- For system_design rounds, create open-ended design problems relevant to the role
- For behavioral rounds, use STAR-format probing questions
- Ensure no topic overlap between rounds

Respond with ONLY valid JSON:
{{
  "rounds": [
    {{
      "round_number": 1,
      "type": "screening|technical|coding|system_design|behavioral",
      "questions": [
        {{
          "question": "...",
          "type": "screening|technical|coding|system_design|behavioral",
          "topic": "specific topic being assessed",
          "difficulty": "easy|medium|hard|expert",
          "follow_up_hints": ["...", "..."],
          "expected_approach": "what a strong answer looks like",
          "time_estimate_seconds": 120
        }}
      ]
    }}
  ],
  "opening_message": "A warm, professional greeting introducing yourself and explaining the multi-round format.",
  "total_questions": {max_questions},
  "estimated_duration_minutes": ...,
  "key_topics": ["list of main topics that will be covered"]
}}"""

    result = _chat_completion(
        [{"role": "system", "content": system_prompt}],
        temperature=0.7,
        json_mode=True,
    )
    plan = _safe_parse_json(result)
    plan["seniority_level"] = seniority
    plan["interview_type"] = interview_type
    plan["include_coding"] = include_coding
    plan["coding_language"] = coding_language
    return plan


# Backwards-compatible wrapper
def generate_question_plan(
    parsed_jd: dict,
    parsed_resume: dict,
    interview_type: str,
    include_coding: bool,
    coding_language: Optional[str],
    max_questions: int,
) -> dict:
    """Generate a structured question plan — delegates to multi-round planner.

    Returns both the new multi-round format AND a flat questions list for
    backwards compatibility with existing svc-recruiting code.
    """
    plan = generate_interview_plan(
        parsed_jd, parsed_resume, interview_type,
        include_coding, coding_language, max_questions,
    )

    # Flatten questions for backwards compatibility
    flat_questions = []
    for rnd in plan.get("rounds", []):
        for q in rnd.get("questions", []):
            flat_questions.append(q)

    plan["questions"] = flat_questions
    return plan


# ---------------------------------------------------------------------------
# Default Interview State
# ---------------------------------------------------------------------------

def create_initial_interview_state() -> dict:
    """Create the initial adaptive interview state."""
    return {
        "current_round": 1,
        "current_round_type": "screening",
        "round_question_number": 1,
        "questions_asked": [],
        "topics_covered": [],
        "difficulty_level": "medium",
        "candidate_strengths": [],
        "candidate_weaknesses": [],
        "follow_up_count": 0,
        "round_scores": {},
    }


# ---------------------------------------------------------------------------
# Adaptive Interviewer Response
# ---------------------------------------------------------------------------

def _build_adaptive_prompt(
    interview_plan: dict,
    interview_state: dict,
    parsed_jd: dict,
    parsed_resume: dict,
    current_question: int,
    max_questions: int,
) -> str:
    """Build the adaptive interviewer system prompt with current state."""
    template = _load_prompt(ADAPTIVE_PROMPT_PATH)

    # Determine current round context
    rounds = interview_plan.get("rounds", [])
    current_round_num = interview_state.get("current_round", 1)
    round_type = interview_state.get("current_round_type", "technical")
    round_question_number = interview_state.get("round_question_number", 1)
    round_question_total = 0

    for rnd in rounds:
        if rnd.get("round_number") == current_round_num:
            round_question_total = len(rnd.get("questions", []))
            break

    # Build compact plan — only current round questions (saves ~2000 tokens)
    current_round_questions = []
    for rnd in rounds:
        if rnd.get("round_number") == current_round_num:
            current_round_questions = rnd.get("questions", [])
            break

    compact_plan = {
        "total_rounds": len(rounds),
        "round_types": [r.get("type") for r in rounds],
        "current_round": {
            "round_number": current_round_num,
            "type": round_type,
            "questions": current_round_questions,
        },
        "key_topics": interview_plan.get("key_topics", []),
    }

    return template.format(
        parsed_jd=json.dumps(parsed_jd, default=str),
        parsed_resume=json.dumps(parsed_resume, default=str),
        interview_plan=json.dumps(compact_plan, default=str),
        current_round=current_round_num,
        round_type=round_type,
        current_question=current_question,
        max_questions=max_questions,
        round_question_number=round_question_number,
        round_question_total=round_question_total,
        difficulty_level=interview_state.get("difficulty_level", "medium"),
        topics_covered=json.dumps(interview_state.get("topics_covered", [])),
        candidate_strengths=json.dumps(interview_state.get("candidate_strengths", [])),
        candidate_weaknesses=json.dumps(interview_state.get("candidate_weaknesses", [])),
        questions_asked=json.dumps(interview_state.get("questions_asked", [])),
    )


def generate_adaptive_response(
    conversation_history: List[Dict[str, str]],
    current_question: int,
    interview_plan: dict,
    interview_state: dict,
    parsed_jd: dict,
    parsed_resume: dict,
    interview_type: str,
    max_questions: int,
) -> dict:
    """Generate an adaptive interviewer response with state updates."""
    system_prompt = _build_adaptive_prompt(
        interview_plan, interview_state, parsed_jd, parsed_resume,
        current_question, max_questions,
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(conversation_history)

    # Determine if we're transitioning rounds
    rounds = interview_plan.get("rounds", [])
    current_round_num = interview_state.get("current_round", 1)
    round_question_number = interview_state.get("round_question_number", 1)

    current_round = None
    next_round = None
    for i, rnd in enumerate(rounds):
        if rnd.get("round_number") == current_round_num:
            current_round = rnd
            if i + 1 < len(rounds):
                next_round = rounds[i + 1]
            break

    round_questions_total = len(current_round.get("questions", [])) if current_round else 0
    is_round_end = round_question_number >= round_questions_total
    is_interview_end = current_question >= max_questions

    transition_hint = ""
    if is_interview_end:
        transition_hint = "This is the LAST question. After evaluating the answer, wrap up the interview professionally."
    elif is_round_end and next_round:
        transition_hint = (
            f"This is the last question of the {current_round['type']} round. "
            f"After this, transition to the {next_round['type']} round."
        )

    messages.append({
        "role": "system",
        "content": (
            f"You are on question {current_question} of {max_questions}. "
            f"Round {current_round_num}, question {round_question_number} of {round_questions_total}. "
            f"{transition_hint} "
            "Evaluate the candidate's last answer, update your assessment, then respond. "
            "Respond with ONLY valid JSON: "
            '{"message": "your response text", '
            '"message_type": "follow_up|question|closing|round_transition", '
            '"move_to_next": true/false, '
            '"advance_round": true/false, '
            '"code_prompt": null or {"problem": "...", "language": "...", "examples": "...", "expected_approach": "..."}, '
            '"state_updates": {'
            '"difficulty_adjustment": "increase|maintain|decrease", '
            '"topic_covered": "topic string or null", '
            '"strength_observed": "strength string or null", '
            '"weakness_observed": "weakness string or null"'
            "}}"
        ),
    })

    result = _chat_completion(messages, temperature=0.7, json_mode=True)
    parsed = _safe_parse_json(result)

    # Apply state updates
    state_updates = parsed.get("state_updates", {})
    new_state = {**interview_state}

    # Difficulty adjustment
    adj = state_updates.get("difficulty_adjustment", "maintain")
    levels = ["easy", "medium", "hard", "expert"]
    current_idx = levels.index(new_state.get("difficulty_level", "medium"))
    if adj == "increase" and current_idx < len(levels) - 1:
        new_state["difficulty_level"] = levels[current_idx + 1]
    elif adj == "decrease" and current_idx > 0:
        new_state["difficulty_level"] = levels[current_idx - 1]

    # Topic tracking
    topic = state_updates.get("topic_covered")
    if topic and topic not in new_state["topics_covered"]:
        new_state["topics_covered"].append(topic)

    # Strengths/weaknesses
    strength = state_updates.get("strength_observed")
    if strength and strength not in new_state["candidate_strengths"]:
        new_state["candidate_strengths"].append(strength)
    weakness = state_updates.get("weakness_observed")
    if weakness and weakness not in new_state["candidate_weaknesses"]:
        new_state["candidate_weaknesses"].append(weakness)

    # Question tracking
    if parsed.get("move_to_next"):
        new_state["round_question_number"] = new_state.get("round_question_number", 1) + 1
        new_state["follow_up_count"] = 0
    else:
        new_state["follow_up_count"] = new_state.get("follow_up_count", 0) + 1

    # Round advancement
    if parsed.get("advance_round") and next_round:
        new_state["current_round"] = next_round["round_number"]
        new_state["current_round_type"] = next_round["type"]
        new_state["round_question_number"] = 1

    parsed["interview_state"] = new_state
    return parsed


def generate_adaptive_response_stream(
    conversation_history: List[Dict[str, str]],
    current_question: int,
    interview_plan: dict,
    interview_state: dict,
    parsed_jd: dict,
    parsed_resume: dict,
    interview_type: str,
    max_questions: int,
):
    """Streaming version of adaptive response — OpenAI only, falls back to non-streaming."""
    system_prompt = _build_adaptive_prompt(
        interview_plan, interview_state, parsed_jd, parsed_resume,
        current_question, max_questions,
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(conversation_history)
    messages.append({
        "role": "system",
        "content": (
            f"You are on question {current_question} of {max_questions}. "
            "Evaluate the candidate's last answer, then respond. "
            "Respond with ONLY valid JSON: "
            '{"message": "your response text", "message_type": "follow_up|question|closing|round_transition", '
            '"move_to_next": true/false, "advance_round": true/false, '
            '"code_prompt": null or {"problem": "...", "language": "...", "examples": "..."}, '
            '"state_updates": {"difficulty_adjustment": "increase|maintain|decrease", '
            '"topic_covered": null, "strength_observed": null, "weakness_observed": null}}'
        ),
    })

    provider = _get_provider()
    if provider == "openai":
        return _openai_chat_stream(messages, temperature=0.7)
    return _chat_completion(messages, temperature=0.7)


# ---------------------------------------------------------------------------
# Legacy (non-adaptive) functions — kept for backwards compatibility
# ---------------------------------------------------------------------------

def generate_interviewer_response_stream(
    conversation_history: List[Dict[str, str]],
    current_question: int,
    questions_plan: dict,
    parsed_jd: dict,
    parsed_resume: dict,
    interview_type: str,
    max_questions: int,
):
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

    provider = _get_provider()
    if provider == "openai":
        return _openai_chat_stream(messages, temperature=0.7)
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
    return _safe_parse_json(result)


# ---------------------------------------------------------------------------
# Deep Evaluation
# ---------------------------------------------------------------------------

def generate_deep_evaluation(
    transcript: list,
    parsed_jd: dict,
    parsed_resume: dict,
    interview_plan: dict,
    interview_state: dict,
    proctoring_summary: dict,
) -> dict:
    """Generate comprehensive multi-dimensional evaluation."""
    eval_template = _load_prompt(DEEP_EVALUATION_PROMPT_PATH)
    prompt = eval_template.format(
        transcript=json.dumps(transcript, default=str),
        parsed_jd=json.dumps(parsed_jd, default=str),
        parsed_resume=json.dumps(parsed_resume, default=str),
        interview_plan=json.dumps(interview_plan, default=str),
        interview_state=json.dumps(interview_state, default=str),
        proctoring_summary=json.dumps(proctoring_summary, default=str),
    )

    result = _chat_completion(
        [{"role": "system", "content": prompt}],
        temperature=0.3,
        json_mode=True,
    )
    return _safe_parse_json(result)


# Legacy evaluation — kept for backwards compatibility
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
    return _safe_parse_json(result)


# ---------------------------------------------------------------------------
# Code Evaluation (enhanced)
# ---------------------------------------------------------------------------

def evaluate_code_submission(
    code: str,
    language: str,
    problem_description: str,
    expected_approach: Optional[str] = None,
) -> dict:
    """Evaluate a code submission via LLM with enhanced analysis."""
    prompt = f"""Evaluate this code submission for an interview coding challenge.

Problem: {problem_description}
Language: {language}
Expected Approach: {expected_approach or "Not specified"}

Submitted Code:
```{language}
{code}
```

Evaluate on:
1. Correctness — does it solve the problem? Would it pass all edge cases?
2. Efficiency — time/space complexity analysis
3. Code quality — readability, naming, structure, idiomatic usage
4. Approach — did they use an appropriate algorithm/data structure?
5. Edge cases — did they handle boundary conditions?

Respond with ONLY valid JSON:
{{
  "score": 0-100,
  "feedback": "Brief constructive feedback",
  "passed": true/false,
  "correctness": "correct|partial|incorrect",
  "efficiency": "optimal|acceptable|suboptimal",
  "code_quality": "excellent|good|fair|poor",
  "time_complexity": "O(...)",
  "space_complexity": "O(...)",
  "edge_cases_handled": true/false,
  "suggestions": ["improvement suggestion 1", "improvement suggestion 2"]
}}"""

    result = _chat_completion(
        [{"role": "system", "content": prompt}],
        temperature=0.3,
        json_mode=True,
    )
    return _safe_parse_json(result)


# ---------------------------------------------------------------------------
# Recruiter Report Generation
# ---------------------------------------------------------------------------

def generate_recruiter_report(
    evaluation: dict,
    parsed_jd: dict,
    parsed_resume: dict,
    transcript: list,
    interview_plan: dict,
    proctoring_summary: dict,
) -> dict:
    """Generate a structured recruiter-friendly hiring report."""
    prompt = f"""Generate a concise, actionable hiring report for a recruiter based on this AI interview evaluation.

Evaluation Data:
{json.dumps(evaluation, default=str)}

Job Description:
{json.dumps(parsed_jd, default=str)}

Candidate Resume:
{json.dumps(parsed_resume, default=str)}

Interview Plan:
{json.dumps(interview_plan, default=str)}

Proctoring Summary:
{json.dumps(proctoring_summary, default=str)}

Generate a recruiter report with clear, actionable insights. The report should be understandable by a non-technical recruiter.

Respond with ONLY valid JSON:
{{
  "candidate_name": "...",
  "role_applied": "...",
  "interview_date": "...",
  "interview_duration_minutes": 0,
  "overall_score": 0.0,
  "hire_recommendation": "strong_hire|hire|maybe|no_hire",
  "executive_summary": "2-3 sentence summary of the candidate's performance",
  "score_card": {{
    "technical_knowledge": {{"score": 0.0, "max": 10, "assessment": "brief note"}},
    "problem_solving": {{"score": 0.0, "max": 10, "assessment": "brief note"}},
    "communication": {{"score": 0.0, "max": 10, "assessment": "brief note"}},
    "system_design": {{"score": 0.0, "max": 10, "assessment": "brief note"}},
    "coding_skill": {{"score": 0.0, "max": 10, "assessment": "brief note"}},
    "confidence": {{"score": 0.0, "max": 10, "assessment": "brief note"}}
  }},
  "top_strengths": ["...", "..."],
  "areas_of_concern": ["...", "..."],
  "risk_flags": ["..."],
  "integrity_assessment": {{
    "score": 0,
    "risk_level": "low|medium|high|critical",
    "notes": "..."
  }},
  "recommended_next_steps": ["..."],
  "comparison_notes": "How this candidate compares to the role requirements",
  "interviewer_notes": "Any additional context the hiring team should know"
}}"""

    result = _chat_completion(
        [{"role": "system", "content": prompt}],
        temperature=0.3,
        json_mode=True,
    )
    return _safe_parse_json(result)
