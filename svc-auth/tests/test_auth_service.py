"""
Unit tests for app.services.auth_service.

All database interactions are replaced with AsyncMock / MagicMock so no
real PostgreSQL connection is required.
"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException

from app.core.security import hash_password
from app.services import auth_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(
    id=1,
    email="alice@example.com",
    first_name="Alice",
    last_name="Smith",
    role="recruiter",
    must_change_password=False,
    hashed_pw=None,
):
    user = MagicMock()
    user.id = id
    user.email = email
    user.first_name = first_name
    user.last_name = last_name
    user.role = role
    user.is_active = True
    user.must_change_password = must_change_password
    user.hashed_password = hashed_pw or hash_password("ValidPass1!")
    user.created_at = datetime(2024, 1, 1)
    user.last_login = datetime(2024, 1, 1)
    user.picture = None
    user.google_refresh_token = None
    user.google_access_token = None
    user.provider = None
    return user


def _db_with_user(user=None):
    """Return an AsyncMock DB whose execute returns the given user (or None)."""
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = user
    result.scalars.return_value.all.return_value = [user] if user else []
    db.execute.return_value = result
    db.commit = AsyncMock()
    db.add = MagicMock()
    db.refresh = AsyncMock()
    return db


# ---------------------------------------------------------------------------
# signup_user
# ---------------------------------------------------------------------------

async def test_signup_user_creates_new_user(mock_db):
    await auth_service.signup_user(
        mock_db, "new@example.com", "Pass123!", "Bob", "Jones"
    )
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()


async def test_signup_user_raises_if_email_exists():
    existing = _make_user(email="taken@example.com")
    db = _db_with_user(existing)

    with pytest.raises(HTTPException) as exc:
        await auth_service.signup_user(
            db, "taken@example.com", "Pass123!", "Alice", "Jones"
        )
    assert exc.value.status_code == 400
    assert "already exists" in exc.value.detail.lower()


# ---------------------------------------------------------------------------
# login_user
# ---------------------------------------------------------------------------

async def test_login_user_returns_user_on_correct_credentials():
    plain_pw = "ValidPass1!"
    user = _make_user(hashed_pw=hash_password(plain_pw))
    db = _db_with_user(user)

    result = await auth_service.login_user(db, user.email, plain_pw)
    assert result is user


async def test_login_user_raises_on_wrong_password():
    user = _make_user(hashed_pw=hash_password("CorrectPass1!"))
    db = _db_with_user(user)

    with pytest.raises(HTTPException) as exc:
        await auth_service.login_user(db, user.email, "WrongPass99!")
    assert exc.value.status_code == 401


async def test_login_user_raises_when_user_not_found():
    db = _db_with_user(None)  # no user in DB

    with pytest.raises(HTTPException) as exc:
        await auth_service.login_user(db, "ghost@example.com", "AnyPass1!")
    assert exc.value.status_code == 401


# ---------------------------------------------------------------------------
# reset_password
# ---------------------------------------------------------------------------

async def test_reset_password_commits_update(mock_db):
    await auth_service.reset_password(mock_db, user_id=1, new_password="NewSecure1!")
    mock_db.execute.assert_awaited()
    mock_db.commit.assert_awaited_once()


# ---------------------------------------------------------------------------
# get_all_users
# ---------------------------------------------------------------------------

async def test_get_all_users_returns_list():
    user = _make_user()
    db = _db_with_user(user)

    users = await auth_service.get_all_users(db)
    assert isinstance(users, list)


# ---------------------------------------------------------------------------
# create_new_user
# ---------------------------------------------------------------------------

async def test_create_new_user_succeeds():
    db = _db_with_user(None)  # no existing user

    new_user_data = MagicMock()
    new_user_data.email = "brand.new@example.com"
    new_user_data.first_name = "Brand"
    new_user_data.last_name = "New"
    new_user_data.role = "recruiter"
    new_user_data.password = "Safe1Password!"

    # db.refresh needs to populate the newly added user with an id
    refreshed = _make_user(id=99, email=new_user_data.email)
    db.refresh.side_effect = lambda u: setattr(u, "id", 99) or None

    with patch("app.services.auth_service.publish_event", new_callable=AsyncMock):
        result = await auth_service.create_new_user(db, new_user_data)
    assert result == {"message": "User created successfully"}


async def test_create_new_user_raises_if_email_taken():
    existing = _make_user(email="taken@example.com")
    db = _db_with_user(existing)

    new_user_data = MagicMock()
    new_user_data.email = "taken@example.com"

    with pytest.raises(HTTPException) as exc:
        await auth_service.create_new_user(db, new_user_data)
    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# update_user / delete_user
# ---------------------------------------------------------------------------

async def test_update_user_commits():
    db = AsyncMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()

    update_data = MagicMock()
    update_data.dict.return_value = {"first_name": "Updated"}

    with patch("app.services.auth_service.publish_event", new_callable=AsyncMock):
        result = await auth_service.update_user(db, "1", update_data)
    assert result == {"message": "User updated successfully"}
    db.commit.assert_awaited_once()


async def test_delete_user_commits():
    db = AsyncMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()

    with patch("app.services.auth_service.publish_event", new_callable=AsyncMock):
        result = await auth_service.delete_user(db, "1")
    assert result == {"message": "User deleted successfully"}
    db.commit.assert_awaited_once()
