"""
Embedding service — per-file-type chunking strategies + multi-provider embeddings.

Each file type gets a tailored chunking approach:
  pdf   -> larger chunks (1200 chars), PDFs are dense prose
  docx  -> heading-aware semantic sections (1000 chars)
  txt   -> paragraph-aware (600 chars)
  md    -> paragraph/heading-aware (700 chars)
  csv   -> row-batch (20 rows + header repeated each chunk)
  xlsx  -> sheet-aware row-batch with column headers
  json  -> flatten to readable text, standard chunking (800 chars)
  default -> RecursiveCharacter 800/100
"""
import json as _json
import os
from typing import Optional

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings

from app.config.settings import OPENAI_API_KEY, OPENAI_EMBED_MODEL


# -- helpers ----------------------------------------------------------------

def _splitter(size: int, overlap: int) -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )


# -- per-type chunkers -----------------------------------------------------

def _chunk_pdf(text: str) -> list[str]:
    return _splitter(1200, 150).split_text(text)

def _chunk_docx(text: str) -> list[str]:
    return _splitter(1000, 150).split_text(text)

def _chunk_txt(text: str) -> list[str]:
    return _splitter(600, 80).split_text(text)

def _chunk_md(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=700, chunk_overlap=100,
        separators=["## ", "### ", "\n\n", "\n", " ", ""],
    )
    return splitter.split_text(text)

def _chunk_csv(text: str) -> list[str]:
    lines = text.strip().splitlines()
    if not lines:
        return []
    header = lines[0]
    data_rows = lines[1:]
    if not data_rows:
        return [header]
    batch = 20
    chunks: list[str] = []
    for i in range(0, len(data_rows), batch):
        chunk = header + "\n" + "\n".join(data_rows[i : i + batch])
        chunks.append(chunk)
    return chunks

def _chunk_xlsx(text: str) -> list[str]:
    sheets = text.strip().split("\n\n")
    chunks: list[str] = []
    for sheet in sheets:
        if not sheet.strip():
            continue
        lines = sheet.strip().splitlines()
        if len(lines) < 2:
            chunks.append(sheet)
            continue
        sheet_label = lines[0]
        col_header = lines[1]
        data_rows = lines[2:]
        header_prefix = f"{sheet_label}\n{col_header}"
        if not data_rows:
            chunks.append(header_prefix)
            continue
        batch = 20
        for i in range(0, len(data_rows), batch):
            chunk = header_prefix + "\n" + "\n".join(data_rows[i : i + batch])
            chunks.append(chunk)
    return chunks or _splitter(800, 100).split_text(text)

def _chunk_json(text: str) -> list[str]:
    try:
        data = _json.loads(text)
        flat = _flatten_json(data)
        readable = "\n".join(f"{k}: {v}" for k, v in flat.items())
    except Exception:
        readable = text
    return _splitter(800, 100).split_text(readable)

def _flatten_json(obj, prefix: str = "") -> dict:
    items: dict = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_key = f"{prefix}.{k}" if prefix else k
            items.update(_flatten_json(v, new_key))
    elif isinstance(obj, list):
        for i, v in enumerate(obj[:50]):
            items.update(_flatten_json(v, f"{prefix}[{i}]"))
    else:
        items[prefix] = str(obj)[:500]
    return items

def _chunk_default(text: str) -> list[str]:
    return _splitter(800, 100).split_text(text)


# -- strategy router -------------------------------------------------------

_STRATEGY: dict[str, callable] = {
    "pdf":   _chunk_pdf,
    "docx":  _chunk_docx,
    "doc":   _chunk_docx,
    "txt":   _chunk_txt,
    "md":    _chunk_md,
    "csv":   _chunk_csv,
    "xlsx":  _chunk_xlsx,
    "xls":   _chunk_xlsx,
    "json":  _chunk_json,
}


# -- multi-provider embeddings ---------------------------------------------

def _get_embeddings_model():
    """Return an embeddings model based on the configured provider."""
    provider = os.getenv("LLM_PROVIDER", "openai")

    if provider == "gemini":
        try:
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            return GoogleGenerativeAIEmbeddings(
                model=os.getenv("GOOGLE_EMBED_MODEL", "models/embedding-001"),
                google_api_key=os.getenv("GOOGLE_API_KEY", ""),
            )
        except ImportError:
            pass  # fall through to OpenAI

    # Default: OpenAI embeddings (also used for Anthropic since Anthropic has no embeddings API)
    return OpenAIEmbeddings(model=OPENAI_EMBED_MODEL, api_key=OPENAI_API_KEY)


# -- public API -------------------------------------------------------------

def embed_document(text: str, file_type: str = "txt") -> list[dict]:
    """
    Chunk *text* using the strategy appropriate for *file_type*,
    then embed every chunk.

    Returns a list of dicts with keys: chunk_index, content, embedding.
    """
    ft = file_type.lower().lstrip(".")
    chunker = _STRATEGY.get(ft, _chunk_default)
    chunks = chunker(text)
    if not chunks:
        return []

    model = _get_embeddings_model()
    vectors = model.embed_documents(chunks)
    return [
        {"chunk_index": i, "content": c, "embedding": v}
        for i, (c, v) in enumerate(zip(chunks, vectors))
    ]


def embed_query(query: str) -> list[float]:
    model = _get_embeddings_model()
    return model.embed_query(query)
