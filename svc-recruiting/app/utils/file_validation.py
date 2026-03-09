"""
File MIME-type validation using magic number (file signature) detection.

Zero external dependencies -- reads the first bytes of the uploaded file
to determine the real file type regardless of the declared Content-Type
or file extension, preventing disguised-file attacks.
"""

from __future__ import annotations

import os
from typing import Optional

from fastapi import HTTPException, UploadFile


# ── Magic-number signatures ──────────────────────────────────────────────────
# Each entry maps a human-readable label to (magic_bytes, offset).
# Offset is almost always 0.

_SIGNATURES: list[tuple[str, bytes, int]] = [
    # PDF  —  %PDF
    ("application/pdf", b"%PDF", 0),
    # DOCX / ODT / any OOXML  —  PK zip header
    ("application/zip+office", b"PK\x03\x04", 0),
    # Legacy DOC (OLE2 Compound Binary)
    ("application/msword", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", 0),
    # RTF
    ("text/rtf", b"{\\rtf", 0),
]

# MIME types we accept (after signature resolution)
ALLOWED_MIME_TYPES: set[str] = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/rtf",
    "application/rtf",
    "application/vnd.oasis.opendocument.text",
}

ALLOWED_EXTENSIONS: set[str] = {".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt"}

# Agent uploads may also allow images
AGENT_ALLOWED_EXTENSIONS: set[str] = {
    ".pdf", ".doc", ".docx", ".txt", ".png", ".jpg", ".jpeg",
}
AGENT_IMAGE_SIGNATURES: list[tuple[str, bytes, int]] = [
    ("image/png", b"\x89PNG\r\n\x1a\n", 0),
    ("image/jpeg", b"\xff\xd8\xff", 0),
]


def _detect_mime_from_bytes(header: bytes, extra_signatures: list | None = None) -> Optional[str]:
    """Return the detected MIME type from the first bytes, or None."""
    all_sigs = list(_SIGNATURES)
    if extra_signatures:
        all_sigs.extend(extra_signatures)

    for mime, magic, offset in all_sigs:
        end = offset + len(magic)
        if len(header) >= end and header[offset:end] == magic:
            return mime
    return None


def _resolve_zip_office_mime(extension: str) -> str:
    """Distinguish DOCX from ODT (both are PK zip archives) using file extension."""
    ext = extension.lower()
    if ext == ".odt":
        return "application/vnd.oasis.opendocument.text"
    # Default to DOCX for .docx or unknown zip-office files
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


async def validate_upload_mime(
    file: UploadFile,
    contents: bytes,
    *,
    allowed_mimes: set[str] | None = None,
    allowed_extensions: set[str] | None = None,
    extra_signatures: list | None = None,
) -> str:
    """
    Validate an uploaded file by reading magic bytes.

    Parameters
    ----------
    file : UploadFile
        The FastAPI upload file object (used for filename / content_type).
    contents : bytes
        The already-read file bytes.
    allowed_mimes : set[str] | None
        Set of acceptable MIME types. Defaults to ALLOWED_MIME_TYPES.
    allowed_extensions : set[str] | None
        Set of acceptable extensions. Defaults to ALLOWED_EXTENSIONS.
    extra_signatures : list | None
        Additional (mime, magic_bytes, offset) tuples for detection.

    Returns
    -------
    str
        The validated MIME type.

    Raises
    ------
    HTTPException (400)
        If the file content does not match any allowed type.
    """
    if allowed_mimes is None:
        allowed_mimes = ALLOWED_MIME_TYPES
    if allowed_extensions is None:
        allowed_extensions = ALLOWED_EXTENSIONS

    extension = os.path.splitext(file.filename or "")[1].lower()

    # Read enough bytes for signature detection (first 16 bytes is plenty)
    header = contents[:16]

    detected = _detect_mime_from_bytes(header, extra_signatures=extra_signatures)

    # Resolve zip-based office formats using extension
    if detected == "application/zip+office":
        detected = _resolve_zip_office_mime(extension)

    # If we detected a known type, check it's allowed
    if detected:
        if detected in allowed_mimes:
            return detected
        raise HTTPException(
            status_code=400,
            detail=(
                f"File content detected as '{detected}' which is not allowed. "
                f"Supported formats: {', '.join(sorted(allowed_extensions))}"
            ),
        )

    # No magic match — allow .txt files (plain text has no fixed signature)
    if extension == ".txt" and "text/plain" in allowed_mimes:
        return "text/plain"

    # Fallback: reject
    raise HTTPException(
        status_code=400,
        detail=(
            f"Could not verify file type from content. "
            f"Supported formats: {', '.join(sorted(allowed_extensions))}"
        ),
    )


async def validate_resume_upload(file: UploadFile, contents: bytes) -> str:
    """Convenience wrapper for resume uploads (PDF, DOC, DOCX, TXT, RTF, ODT)."""
    return await validate_upload_mime(file, contents)


TRANSCRIPT_ALLOWED_EXTENSIONS: set[str] = {
    ".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt",
    ".mp3", ".mp4", ".wav", ".webm", ".m4a", ".ogg", ".flac",
}
TRANSCRIPT_ALLOWED_MIMES: set[str] = ALLOWED_MIME_TYPES | {
    "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg",
    "audio/flac", "audio/x-m4a", "video/mp4", "video/webm",
}
TRANSCRIPT_SIGNATURES: list[tuple[str, bytes, int]] = [
    # MP3 — ID3 tag or sync word
    ("audio/mpeg", b"ID3", 0),
    ("audio/mpeg", b"\xff\xfb", 0),
    ("audio/mpeg", b"\xff\xf3", 0),
    ("audio/mpeg", b"\xff\xf2", 0),
    # MP4 / M4A — ftyp box (offset 4)
    ("video/mp4", b"ftyp", 4),
    # WAV — RIFF header
    ("audio/wav", b"RIFF", 0),
    # OGG (Vorbis/Opus)
    ("audio/ogg", b"OggS", 0),
    # FLAC
    ("audio/flac", b"fLaC", 0),
    # WebM (Matroska/EBML header)
    ("video/webm", b"\x1a\x45\xdf\xa3", 0),
]


async def validate_transcript_upload(file: UploadFile, contents: bytes) -> str:
    """Validate interview transcript uploads (documents + audio/video)."""
    return await validate_upload_mime(
        file,
        contents,
        allowed_mimes=TRANSCRIPT_ALLOWED_MIMES,
        allowed_extensions=TRANSCRIPT_ALLOWED_EXTENSIONS,
        extra_signatures=TRANSCRIPT_SIGNATURES,
    )


async def validate_agent_upload(file: UploadFile, contents: bytes) -> str:
    """Validate agent file uploads (documents + images)."""
    agent_mimes = ALLOWED_MIME_TYPES | {"image/png", "image/jpeg"}
    return await validate_upload_mime(
        file,
        contents,
        allowed_mimes=agent_mimes,
        allowed_extensions=AGENT_ALLOWED_EXTENSIONS,
        extra_signatures=AGENT_IMAGE_SIGNATURES,
    )
