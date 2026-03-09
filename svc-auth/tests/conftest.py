"""
Shared fixtures for svc-auth tests.

All fixtures use mocked DB sessions – no real database connection required.
"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock


def _make_mock_user(
    id=1,
    email="test@example.com",
    first_name="Test",
    last_name="User",
    role="recruiter",
    is_active=True,
    must_change_password=False,
    hashed_password=None,
):
    """Build a fake SQLAlchemy User object using MagicMock."""
    from app.core.security import hash_password

    user = MagicMock()
    user.id = id
    user.email = email
    user.first_name = first_name
    user.last_name = last_name
    user.role = role
    user.is_active = is_active
    user.must_change_password = must_change_password
    user.hashed_password = hashed_password or hash_password("TestPassword123!")
    user.created_at = datetime(2024, 1, 1, 0, 0, 0)
    user.last_login = datetime(2024, 1, 1, 0, 0, 0)
    user.picture = None
    user.google_refresh_token = None
    user.google_access_token = None
    user.provider = None
    return user


@pytest.fixture
def mock_user():
    return _make_mock_user()


@pytest.fixture
def mock_admin_user():
    return _make_mock_user(id=2, email="admin@example.com", role="admin")


@pytest.fixture
def mock_db():
    """Async database session stub."""
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    result.scalars.return_value.all.return_value = []
    db.execute.return_value = result
    db.commit = AsyncMock()
    db.add = MagicMock()
    db.refresh = AsyncMock()
    return db
