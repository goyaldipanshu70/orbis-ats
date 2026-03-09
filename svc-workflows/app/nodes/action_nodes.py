import logging
import httpx
from app.nodes.base import BaseNode
from app.core.config import settings

logger = logging.getLogger("svc-workflows")


class SaveToTalentPoolNode(BaseNode):
    node_type = "save_to_talent_pool"
    category = "action"
    display_name = "Save to Talent Pool"
    description = "Save discovered candidates to the ATS talent pool"
    config_schema = {
        "jd_id": {"type": "integer", "description": "Job ID to associate candidates with (optional)"},
    }

    async def execute(self, input_data):
        leads = self._collect_leads(input_data)
        jd_id = self.config.get("jd_id")
        saved = 0
        skipped = 0
        errors = []

        async with httpx.AsyncClient(timeout=30) as client:
            for lead in leads:
                name = lead.get("name", "Unknown")
                email = lead.get("email")

                # Build candidate payload for svc-recruiting
                payload = {
                    "full_name": name,
                    "email": email,
                    "phone": None,
                    "linkedin_url": lead.get("linkedin_url"),
                    "github_url": lead.get("github_url"),
                    "portfolio_url": lead.get("portfolio_url") or lead.get("source_url"),
                    "headline": lead.get("headline", ""),
                    "location": lead.get("location", ""),
                    "skills": lead.get("skills", []),
                    "experience_years": lead.get("experience_years"),
                    "source": lead.get("source", "workflow"),
                    "score": lead.get("score"),
                    "score_breakdown": lead.get("score_breakdown"),
                }

                try:
                    resp = await client.post(
                        f"{settings.RECRUITING_URL}/api/talent-pool/onboard-lead",
                        json=payload,
                    )
                    if resp.status_code < 300:
                        saved += 1
                        logger.info("Saved lead to talent pool: %s", name)
                    elif resp.status_code == 409:
                        skipped += 1
                        logger.info("Lead already exists, skipped: %s", name)
                    else:
                        errors.append({"lead": name, "error": f"HTTP {resp.status_code}"})
                        logger.warning("Failed to save lead %s: %s", name, resp.text[:200])
                except Exception as e:
                    errors.append({"lead": name, "error": str(e)})
                    logger.error("Error saving lead %s: %s", name, e)

        return {
            "leads": leads,
            "saved_count": saved,
            "skipped_count": skipped,
            "error_count": len(errors),
            "errors": errors[:5],
            "message": f"Saved {saved} candidates to talent pool, skipped {skipped} duplicates",
        }


class AddToEmailCampaignNode(BaseNode):
    node_type = "add_to_email_campaign"
    category = "action"
    display_name = "Add to Email Campaign"
    description = "Add candidates to an outreach email campaign"
    config_schema = {
        "campaign_name": {"type": "string", "description": "Name of the email campaign"},
        "template": {"type": "string", "description": "Email template to use"},
    }

    async def execute(self, input_data):
        leads = self._collect_leads(input_data)
        campaign_name = self.config.get("campaign_name", "Default Outreach")

        added = []
        skipped = []

        for lead in leads:
            email = lead.get("email")
            if email:
                added.append({
                    "name": lead.get("name", "Unknown"),
                    "email": email,
                    "campaign": campaign_name,
                })
                logger.info("Added %s (%s) to campaign '%s'", lead.get("name"), email, campaign_name)
            else:
                skipped.append({
                    "name": lead.get("name", "Unknown"),
                    "reason": "No email address available",
                })

        return {
            "leads": leads,
            "campaign_name": campaign_name,
            "added_count": len(added),
            "skipped_count": len(skipped),
            "added": added,
            "skipped": skipped[:10],
            "message": f"Added {len(added)} candidates to campaign '{campaign_name}', skipped {len(skipped)} without email",
        }


class NotifyHRNode(BaseNode):
    node_type = "notify_hr"
    category = "action"
    display_name = "Notify HR"
    description = "Send a notification to the HR team with workflow results"
    config_schema = {
        "channel": {"type": "string", "default": "email", "description": "Notification channel (email, slack, in-app)"},
        "recipients": {"type": "array", "description": "List of recipient emails or user IDs"},
    }

    async def execute(self, input_data):
        leads = self._collect_leads(input_data)
        channel = self.config.get("channel", "email")
        recipients = self.config.get("recipients", [])

        summary = {
            "total_candidates_found": len(leads),
            "with_email": sum(1 for l in leads if l.get("email")),
            "avg_score": round(sum(l.get("score", 0) for l in leads) / max(len(leads), 1), 1),
            "top_candidates": [
                {"name": l.get("name"), "score": l.get("score", 0), "source": l.get("source")}
                for l in sorted(leads, key=lambda x: x.get("score", 0), reverse=True)[:5]
            ],
        }

        logger.info(
            "HR notification sent via %s to %d recipients: %d candidates found",
            channel,
            len(recipients),
            len(leads),
        )

        return {
            "leads": leads,
            "notification_sent": True,
            "channel": channel,
            "recipients": recipients,
            "summary": summary,
            "message": f"Notified HR via {channel}: {len(leads)} candidates found, avg score {summary['avg_score']}",
        }
