import asyncio
import ipaddress
import logging
import json
import re
from typing import Optional, Union
from urllib.parse import urlparse

logger = logging.getLogger("svc-workflows")


async def retry_async(coro_fn, max_retries: int = 2, backoff: float = 1.0, max_delay: float = 30.0, label: str = ""):
    """Retry an async callable with exponential backoff.

    Args:
        coro_fn: Zero-argument async callable (lambda or partial)
        max_retries: Number of retries after the first failure
        backoff: Base delay in seconds (doubles each retry)
        max_delay: Maximum delay between retries (cap for exponential growth)
        label: Label for log messages
    """
    last_exc = None
    for attempt in range(max_retries + 1):
        try:
            return await coro_fn()
        except Exception as e:
            last_exc = e
            if attempt < max_retries:
                delay = min(backoff * (2 ** attempt), max_delay)
                logger.warning(
                    "%s attempt %d/%d failed: %s — retrying in %.1fs",
                    label, attempt + 1, max_retries + 1, e, delay,
                )
                await asyncio.sleep(delay)
            else:
                logger.error("%s failed after %d attempts: %s", label, max_retries + 1, e)
    raise last_exc


def safe_parse_json(text: str) -> Optional[Union[list, dict]]:
    """Parse JSON from LLM output, handling markdown fences and common issues."""
    if not text:
        return None

    cleaned = text.strip()

    # Strip markdown code fences
    if cleaned.startswith("```"):
        # Remove opening fence (with optional language tag)
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        # Remove closing fence
        if "```" in cleaned:
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

    # Try direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try to find JSON array or object in the text
    for pattern in [r'\[[\s\S]*\]', r'\{[\s\S]*\}']:
        match = re.search(pattern, cleaned)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                continue

    return None


def is_safe_url(url: str) -> bool:
    """Check that a URL is safe to fetch (not targeting internal/private networks)."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        # Block obvious internal hostnames
        if hostname in ("localhost", "127.0.0.1", "0.0.0.0", "[::]", "[::1]"):
            return False
        # Block private/reserved IP ranges
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_reserved or ip.is_loopback or ip.is_link_local:
                return False
        except ValueError:
            # hostname is a domain name, not an IP — check for common internal patterns
            lower = hostname.lower()
            if lower.endswith(".internal") or lower.endswith(".local") or lower.endswith(".localhost"):
                return False
        return True
    except Exception:
        return False
