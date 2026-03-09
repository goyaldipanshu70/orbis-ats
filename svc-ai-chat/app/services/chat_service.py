"""Chat service — multi-provider (OpenAI, Anthropic, Gemini)."""
import os
import logging
from typing import Generator

logger = logging.getLogger("svc-ai-chat")


def _get_provider() -> str:
    return os.getenv("LLM_PROVIDER", "openai")


def _get_openai_client():
    from openai import OpenAI
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))


def _openai_model() -> str:
    return os.getenv("OPENAI_CHAT_MODEL", os.getenv("OPENAI_MODEL", "gpt-4o-mini"))


# ---------------------------------------------------------------------------
# Unified chat completion
# ---------------------------------------------------------------------------

def _chat_complete(messages: list[dict]) -> str:
    provider = _get_provider()

    if provider == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
        system_text = ""
        user_msgs = []
        for m in messages:
            if m["role"] == "system":
                system_text += m["content"] + "\n"
            else:
                user_msgs.append(m)
        if not user_msgs:
            user_msgs = [{"role": "user", "content": "..."}]
        r = client.messages.create(
            model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
            max_tokens=4096,
            system=system_text.strip(),
            messages=user_msgs,
        )
        return r.content[0].text

    if provider == "gemini":
        import google.generativeai as genai
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY", ""))
        model = genai.GenerativeModel(os.getenv("GOOGLE_MODEL", "gemini-2.0-flash"))
        prompt_parts = []
        for m in messages:
            role = m["role"].upper()
            prompt_parts.append(f"[{role}]: {m['content']}")
        r = model.generate_content("\n\n".join(prompt_parts))
        return r.text

    # Default: OpenAI
    client = _get_openai_client()
    response = client.chat.completions.create(
        model=_openai_model(),
        messages=messages,
    )
    return response.choices[0].message.content


def _chat_complete_stream(messages: list[dict]) -> Generator[str, None, None]:
    provider = _get_provider()

    if provider == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
        system_text = ""
        user_msgs = []
        for m in messages:
            if m["role"] == "system":
                system_text += m["content"] + "\n"
            else:
                user_msgs.append(m)
        if not user_msgs:
            user_msgs = [{"role": "user", "content": "..."}]
        with client.messages.stream(
            model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
            max_tokens=4096,
            system=system_text.strip(),
            messages=user_msgs,
        ) as stream:
            for text in stream.text_stream:
                yield text
        return

    if provider == "gemini":
        import google.generativeai as genai
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY", ""))
        model = genai.GenerativeModel(os.getenv("GOOGLE_MODEL", "gemini-2.0-flash"))
        prompt_parts = []
        for m in messages:
            role = m["role"].upper()
            prompt_parts.append(f"[{role}]: {m['content']}")
        response = model.generate_content("\n\n".join(prompt_parts), stream=True)
        for chunk in response:
            if chunk.text:
                yield chunk.text
        return

    # Default: OpenAI streaming
    client = _get_openai_client()
    response = client.chat.completions.create(
        model=_openai_model(),
        messages=messages,
        stream=True,
    )
    for chunk in response:
        delta = chunk.choices[0].delta if chunk.choices else None
        if delta and delta.content:
            yield delta.content


# ---------------------------------------------------------------------------
# Public API (unchanged signatures)
# ---------------------------------------------------------------------------

def complete_chat(messages: list[dict], system_prompt: str = None) -> str:
    all_messages = []
    if system_prompt:
        all_messages.append({"role": "system", "content": system_prompt})
    all_messages.extend(messages)
    return _chat_complete(all_messages)


def complete_chat_stream(messages: list[dict], system_prompt: str = None) -> Generator[str, None, None]:
    all_messages = []
    if system_prompt:
        all_messages.append({"role": "system", "content": system_prompt})
    all_messages.extend(messages)
    return _chat_complete_stream(all_messages)


def _build_rag_system_prompt(
    context_chunks: list[dict],
    available_docs: list[dict] = None,
) -> str:
    doc_catalogue = ""
    if available_docs:
        doc_lines = "\n".join(
            f"  - {d['name']} ({d.get('file_type', 'file').upper()})"
            for d in available_docs
        )
        doc_catalogue = (
            f"\n\nKNOWLEDGE BASE CATALOGUE ({len(available_docs)} document(s) accessible to this user):\n"
            f"{doc_lines}"
        )

    if context_chunks:
        context_text = "\n\n".join(
            f"[Source: {c.get('doc_name', 'Document')}]\n{c['content']}"
            for c in context_chunks
        )
        context_section = f"\n\nRELEVANT EXCERPTS:\n{context_text}"
    else:
        context_section = "\n\n(No relevant excerpts were retrieved for this query.)"

    return (
        "You are a knowledgeable assistant for an HR platform. "
        "You answer questions based on the documents in the knowledge base.\n"
        "- If the user asks what files/documents are available, list them from the KNOWLEDGE BASE CATALOGUE.\n"
        "- For content questions, use the RELEVANT EXCERPTS. If the answer is not in the excerpts, "
        "say you don't have enough information in the documents."
        + doc_catalogue
        + context_section
    )


def _build_rag_messages(
    question: str,
    history: list[dict] = None,
) -> list[dict]:
    messages = []
    if history:
        messages.extend(history[-6:])
    messages.append({"role": "user", "content": question})
    return messages


def answer_with_context(
    question: str,
    context_chunks: list[dict],
    history: list[dict] = None,
    available_docs: list[dict] = None,
) -> str:
    system_prompt = _build_rag_system_prompt(context_chunks, available_docs)
    messages = _build_rag_messages(question, history)
    all_messages = [{"role": "system", "content": system_prompt}] + messages
    return _chat_complete(all_messages)


def answer_with_context_stream(
    question: str,
    context_chunks: list[dict],
    history: list[dict] = None,
    available_docs: list[dict] = None,
) -> Generator[str, None, None]:
    system_prompt = _build_rag_system_prompt(context_chunks, available_docs)
    messages = _build_rag_messages(question, history)
    all_messages = [{"role": "system", "content": system_prompt}] + messages
    return _chat_complete_stream(all_messages)
