"""
Integration-style tests for svc-auth API routes.

A minimal FastAPI test app is assembled directly from the router so that
no lifespan (init_db / seed) events run and no real database is needed.
Dependencies (get_db, get_current_user) are overridden with fakes.
"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.routes_auth import router
from app.core.security import create_access_token, hash_password
from app.db.postgres import get_db
from app.core.security import get_current_user


# ---------------------------------------------------------------------------
# Helpers / shared state
# ---------------------------------------------------------------------------

PLAIN_PASSWORD = "TestPass99!"


def _make_user(
    id=1,
    email="alice@example.com",
    first_name="Alice",
    last_name="Smith",
    role="recruiter",
    must_change_password=False,
):
    user = MagicMock()
    user.id = id
    user.email = email
    user.first_name = first_name
    user.last_name = last_name
    user.role = role
    user.is_active = True
    user.must_change_password = must_change_password
    user.hashed_password = hash_password(PLAIN_PASSWORD)
    user.created_at = datetime(2024, 1, 1, 0, 0, 0)
    user.last_login = datetime(2024, 1, 1, 0, 0, 0)
    user.picture = None
    user.google_refresh_token = None
    user.google_access_token = None
    user.provider = None
    return user


def _build_test_app(db_override, current_user_override=None):
    """Create a minimal FastAPI app with overridden deps."""
    app = FastAPI()
    app.include_router(router, prefix="/api/auth")
    app.dependency_overrides[get_db] = db_override
    if current_user_override:
        app.dependency_overrides[get_current_user] = current_user_override
    return app


def _make_db_stub(user=None):
    """Return an async DB stub that returns `user` on scalar queries."""
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
# Health-check (root of the full service, not a route in this router)
# – We test it via a separate minimal app.
# ---------------------------------------------------------------------------

def test_health_check_returns_ok():
    app = FastAPI()

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "svc-auth"}

    with TestClient(app) as client:
        resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------

class TestLogin:
    def _client(self, user=None):
        async def db_override():
            yield _make_db_stub(user)

        return TestClient(_build_test_app(db_override))

    def test_login_success_returns_access_token(self):
        user = _make_user()
        client = self._client(user)
        resp = client.post(
            "/api/auth/login",
            json={"email": user.email, "password": PLAIN_PASSWORD},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

    def test_login_wrong_password_returns_401(self):
        user = _make_user()
        client = self._client(user)
        resp = client.post(
            "/api/auth/login",
            json={"email": user.email, "password": "WrongPass99!"},
        )
        assert resp.status_code == 401

    def test_login_nonexistent_user_returns_401(self):
        client = self._client(None)  # no user in DB
        resp = client.post(
            "/api/auth/login",
            json={"email": "ghost@example.com", "password": PLAIN_PASSWORD},
        )
        assert resp.status_code == 401

    def test_login_must_change_password_returns_403(self):
        user = _make_user(must_change_password=True)
        client = self._client(user)
        resp = client.post(
            "/api/auth/login",
            json={"email": user.email, "password": PLAIN_PASSWORD},
        )
        assert resp.status_code == 403
        assert "Password change required" in resp.json()["detail"]

    def test_login_missing_fields_returns_422(self):
        client = self._client()
        resp = client.post("/api/auth/login", json={"email": "only@example.com"})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/auth/signup
# ---------------------------------------------------------------------------

class TestSignup:
    def _client(self, existing_user=None):
        async def db_override():
            yield _make_db_stub(existing_user)

        return TestClient(_build_test_app(db_override))

    def test_signup_new_user_returns_200(self):
        client = self._client(None)
        resp = client.post(
            "/api/auth/signup",
            json={
                "first_name": "Bob",
                "last_name": "Jones",
                "email": "bob@example.com",
                "password": "Secret99!",
                "role": "recruiter",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "User registered successfully"

    def test_signup_duplicate_email_returns_400(self):
        existing = _make_user(email="dup@example.com")
        client = self._client(existing)
        resp = client.post(
            "/api/auth/signup",
            json={
                "first_name": "Eve",
                "last_name": "Evil",
                "email": "dup@example.com",
                "password": "Secret99!",
                "role": "recruiter",
            },
        )
        assert resp.status_code == 400

    def test_signup_invalid_email_returns_422(self):
        client = self._client()
        resp = client.post(
            "/api/auth/signup",
            json={
                "first_name": "Bad",
                "last_name": "Email",
                "email": "not-an-email",
                "password": "Pass1!",
                "role": "recruiter",
            },
        )
        assert resp.status_code == 422

    def test_signup_invalid_role_returns_422(self):
        client = self._client()
        resp = client.post(
            "/api/auth/signup",
            json={
                "first_name": "X",
                "last_name": "Y",
                "email": "xy@example.com",
                "password": "Pass1!",
                "role": "superuser",  # not a valid Role enum value
            },
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------

class TestMe:
    def _client(self, current_user):
        async def db_override():
            yield _make_db_stub(current_user)

        async def user_override():
            return current_user

        return TestClient(_build_test_app(db_override, user_override))

    def _auth_header(self, user):
        token = create_access_token(
            {
                "sub": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
            }
        )
        return {"Authorization": f"Bearer {token}"}

    def test_me_returns_user_profile(self):
        user = _make_user()
        client = self._client(user)
        resp = client.get("/api/auth/me", headers=self._auth_header(user))
        assert resp.status_code == 200
        body = resp.json()
        assert body["email"] == user.email
        assert body["first_name"] == user.first_name
        assert body["role"] == user.role

    def test_me_without_token_returns_401(self):
        user = _make_user()

        # No current_user override → default auth dependency will reject missing token
        async def db_override():
            yield _make_db_stub(user)

        app = FastAPI()
        app.include_router(router, prefix="/api/auth")
        app.dependency_overrides[get_db] = db_override
        # do NOT override get_current_user so real auth runs

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /api/auth/reset-password
# ---------------------------------------------------------------------------

class TestResetPassword:
    def _client(self, current_user):
        async def db_override():
            yield _make_db_stub(current_user)

        async def user_override():
            return current_user

        return TestClient(_build_test_app(db_override, user_override))

    def test_reset_password_returns_success(self):
        user = _make_user()
        client = self._client(user)
        token = create_access_token({"sub": str(user.id), "email": user.email})
        resp = client.post(
            "/api/auth/reset-password",
            json={"new_password": "BrandNew99!"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Password reset successful"
