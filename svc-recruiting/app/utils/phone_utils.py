import re


def normalize_phone(phone: str) -> str:
    """Strip non-digits and keep last 10 digits for consistent matching."""
    digits = re.sub(r"\D", "", phone)
    return digits[-10:] if len(digits) >= 10 else digits
