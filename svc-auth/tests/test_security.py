"""
Unit tests for app.core.security – pure functions that need no database.
"""
from datetime import datetime, timedelta

import pytest
from jose import jwt

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password


# ---------------------------------------------------------------------------
# hash_password / verify_password
# ---------------------------------------------------------------------------

def test_hash_password_is_not_plaintext():
    pw = "SuperSecret99!"
    assert hash_password(pw) != pw


def test_hash_password_produces_bcrypt_hash():
    hashed = hash_password("AnyPassword1!")
    assert hashed.startswith("$2b$")


def test_verify_password_correct():
    pw = "CorrectHorseBatteryStaple"
    assert verify_password(pw, hash_password(pw)) is True


def test_verify_password_wrong():
    pw = "RightPassword"
    assert verify_password("WrongPassword", hash_password(pw)) is False


def test_hash_password_different_for_same_input():
    """bcrypt salts each hash – two hashes of the same input must differ."""
    pw = "SamePassword1!"
    assert hash_password(pw) != hash_password(pw)


# ---------------------------------------------------------------------------
# create_access_token
# ---------------------------------------------------------------------------

def test_create_access_token_returns_non_empty_string():
    token = create_access_token({"sub": "1"})
    assert isinstance(token, str) and len(token) > 0


def test_create_access_token_payload_is_preserved():
    data = {"sub": "42", "email": "user@example.com", "role": "recruiter"}
    token = create_access_token(data)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "42"
    assert payload["email"] == "user@example.com"
    assert payload["role"] == "recruiter"


def test_create_access_token_contains_exp_claim():
    token = create_access_token({"sub": "1"})
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert "exp" in payload


def test_create_access_token_custom_expiry():
    token = create_access_token({"sub": "1"}, expires_minutes=60)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    exp = datetime.utcfromtimestamp(payload["exp"])
    # Should expire roughly 60 minutes from now (±2 min tolerance)
    delta = exp - datetime.utcnow()
    assert timedelta(minutes=58) <= delta <= timedelta(minutes=62)


def test_create_access_token_wrong_secret_is_rejected():
    from jose import JWTError

    token = create_access_token({"sub": "1"})
    with pytest.raises(JWTError):
        jwt.decode(token, "wrong-secret", algorithms=[settings.ALGORITHM])
