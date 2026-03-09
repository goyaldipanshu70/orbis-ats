from app.nodes.base import BaseNode


class FilterNode(BaseNode):
    node_type = "filter"
    category = "processing"
    display_name = "Filter"
    description = "Filter candidates by criteria"
    config_schema = {
        "min_score": {"type": "number", "default": 0, "description": "Minimum score threshold"},
        "location": {"type": "string", "description": "Required location substring"},
        "has_email": {"type": "boolean", "default": False, "description": "Require email address"},
        "max_results": {"type": "integer", "description": "Maximum number of results to keep"},
    }

    async def execute(self, input_data):
        leads = self._collect_leads(input_data)

        min_score = self.config.get("min_score", 0)
        required_location = self.config.get("location", "")
        has_email = self.config.get("has_email", False)
        max_results = self.config.get("max_results")

        filtered = []
        for lead in leads:
            if lead.get("score", 0) < min_score:
                continue
            if required_location and required_location.lower() not in (lead.get("location", "") or "").lower():
                continue
            if has_email and not lead.get("email"):
                continue
            filtered.append(lead)

        if max_results:
            filtered = filtered[:max_results]

        return {"leads": filtered, "count": len(filtered), "filtered_out": len(leads) - len(filtered)}


class DeduplicateNode(BaseNode):
    node_type = "deduplicate"
    category = "processing"
    display_name = "Deduplicate"
    description = "Remove duplicate candidates by email or profile URL"
    config_schema = {}

    async def execute(self, input_data):
        leads = self._collect_leads(input_data)

        seen_emails = set()
        seen_github = set()
        seen_linkedin = set()
        unique_leads = []
        duplicates_removed = 0

        for lead in leads:
            is_duplicate = False

            email = (lead.get("email") or "").lower().strip()
            if email:
                if email in seen_emails:
                    is_duplicate = True
                seen_emails.add(email)

            github = (lead.get("github_url") or "").lower().strip()
            if github and not is_duplicate:
                if github in seen_github:
                    is_duplicate = True
                seen_github.add(github)

            linkedin = (lead.get("linkedin_url") or "").lower().strip()
            if linkedin and not is_duplicate:
                if linkedin in seen_linkedin:
                    is_duplicate = True
                seen_linkedin.add(linkedin)

            if is_duplicate:
                duplicates_removed += 1
            else:
                unique_leads.append(lead)

        return {
            "leads": unique_leads,
            "count": len(unique_leads),
            "duplicates_removed": duplicates_removed,
        }


class RankCandidatesNode(BaseNode):
    node_type = "rank_candidates"
    category = "processing"
    display_name = "Rank Candidates"
    description = "Sort candidates by score in descending order"
    config_schema = {
        "top_n": {"type": "integer", "description": "Keep only top N candidates"},
    }

    async def execute(self, input_data):
        leads = self._collect_leads(input_data)

        ranked = sorted(leads, key=lambda x: x.get("score", 0), reverse=True)

        top_n = self.config.get("top_n")
        if top_n and top_n > 0:
            ranked = ranked[:top_n]

        # Assign rank position
        for i, lead in enumerate(ranked):
            lead["rank"] = i + 1

        return {"leads": ranked, "count": len(ranked)}


class ConditionalNode(BaseNode):
    node_type = "conditional"
    category = "processing"
    display_name = "Conditional Branch"
    description = "Route leads to different branches based on conditions"
    config_schema = {
        "condition_type": {
            "type": "select",
            "options": ["score_threshold", "has_email", "has_linkedin", "location_match", "skill_match"],
            "description": "Type of condition to evaluate",
        },
        "threshold": {"type": "number", "default": 50, "description": "Score threshold (for score_threshold type)"},
        "match_value": {"type": "string", "description": "Value to match against (for location_match/skill_match)"},
    }

    async def execute(self, input_data):
        leads = self._collect_leads(input_data)

        condition_type = self.config.get("condition_type", "score_threshold")
        threshold = self.config.get("threshold", 50)
        match_value = (self.config.get("match_value") or "").lower()

        true_leads = []
        false_leads = []

        for lead in leads:
            if condition_type == "score_threshold":
                passes = lead.get("score", 0) >= threshold
            elif condition_type == "has_email":
                passes = bool(lead.get("email"))
            elif condition_type == "has_linkedin":
                passes = bool(lead.get("linkedin_url"))
            elif condition_type == "location_match":
                passes = match_value in (lead.get("location") or "").lower()
            elif condition_type == "skill_match":
                skills = lead.get("skills") or []
                passes = any(match_value in s.lower() for s in skills)
            else:
                passes = False

            if passes:
                true_leads.append(lead)
            else:
                false_leads.append(lead)

        return {
            "leads": true_leads,
            "true_leads": true_leads,
            "false_leads": false_leads,
            "true_count": len(true_leads),
            "false_count": len(false_leads),
        }
