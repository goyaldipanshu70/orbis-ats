import httpx
from typing import Optional
from app.core.config import settings


async def _get_linkedin_token(user_id: int) -> str:
    """Fetch LinkedIn access token from auth service."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.AUTH_URL}/api/auth/linkedin/token",
            params={"user_id": user_id},
            headers={"X-Internal-Key": settings.INTERNAL_API_KEY},
        )
        if resp.status_code != 200:
            raise Exception(f"Failed to get LinkedIn token: {resp.text}")
        return resp.json()["access_token"]


async def post_job_to_linkedin(user_id: int, job_data: dict) -> dict:
    """Post a job as a UGC post on LinkedIn."""
    token = await _get_linkedin_token(user_id)

    # Build UGC post content
    title = job_data.get("title", "New Position")
    description = job_data.get("description", "")
    location = job_data.get("location", "")
    custom_message = job_data.get("message", "")

    text = custom_message or f"We're hiring! {title}"
    if location:
        text += f" | {location}"
    if description:
        text += f"\n\n{description[:500]}..."
    text += "\n\n#hiring #jobs #careers"

    async with httpx.AsyncClient() as client:
        # Get user profile URN
        profile_resp = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {token}"},
        )
        if profile_resp.status_code != 200:
            raise Exception(f"Failed to get LinkedIn profile: {profile_resp.text}")

        profile = profile_resp.json()
        author_urn = f"urn:li:person:{profile['sub']}"

        # Create UGC post
        post_data = {
            "author": author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": text},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }

        resp = await client.post(
            "https://api.linkedin.com/v2/ugcPosts",
            json=post_data,
            headers={
                "Authorization": f"Bearer {token}",
                "X-Restli-Protocol-Version": "2.0.0",
            },
        )

        if resp.status_code not in (200, 201):
            raise Exception(f"LinkedIn API error: {resp.status_code} - {resp.text}")

        return {"status": "posted", "post_id": resp.json().get("id", ""), "text": text}


async def get_linkedin_profile(profile_url: str, user_id: int) -> dict:
    """Fetch public profile data from LinkedIn."""
    token = await _get_linkedin_token(user_id)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code != 200:
            raise Exception(f"LinkedIn API error: {resp.text}")

        data = resp.json()
        return {
            "name": data.get("name", ""),
            "email": data.get("email", ""),
            "picture": data.get("picture", ""),
            "profile_url": profile_url,
        }


async def send_linkedin_message(user_id: int, recipient_urn: str, message: str) -> dict:
    """Send a LinkedIn direct message. Requires LinkedIn Messaging API partnership."""
    return {
        "status": "error",
        "message": "LinkedIn Messaging API requires a LinkedIn partnership agreement. "
                   "Please apply at https://developer.linkedin.com/ for messaging access. "
                   "In the meantime, use LinkedIn InMail directly.",
    }
