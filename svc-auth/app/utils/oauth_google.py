from authlib.integrations.starlette_client import OAuth
from app.core.config import settings

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={
        "scope": "openid email profile https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
        "access_type": "offline",  # to get refresh_token
        "prompt": "consent",       # always ask so we get refresh token on repeat
    },
)

def get_google_client():
    """
    Returns the Google OAuth client instance.
    """
    return oauth.create_client("google")
