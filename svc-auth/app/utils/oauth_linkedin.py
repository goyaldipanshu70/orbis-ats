from authlib.integrations.starlette_client import OAuth
from app.core.config import settings

oauth = OAuth()
oauth.register(
    name="linkedin",
    client_id=settings.LINKEDIN_CLIENT_ID,
    client_secret=settings.LINKEDIN_CLIENT_SECRET,
    server_metadata_url="https://www.linkedin.com/oauth/.well-known/openid-configuration",
    client_kwargs={
        "scope": "openid profile email w_member_social",
    },
)


def get_linkedin_client():
    """Returns the LinkedIn OAuth client instance."""
    return oauth.create_client("linkedin")
