import json
import logging
from app.nodes.base import BaseNode
from app.core.llm_provider import get_llm

logger = logging.getLogger("svc-workflows")


class AISourcePlannerNode(BaseNode):
    node_type = "ai_source_planner"
    category = "ai"
    display_name = "AI Source Planner"
    description = "AI plans the best search strategy for finding candidates"
    config_schema = {
        "role": {"type": "string", "default": "Software Engineer", "description": "Target role"},
        "skills": {"type": "array", "description": "Required skills"},
        "location": {"type": "string", "description": "Preferred location"},
        "experience_range": {"type": "string", "default": "2-5", "description": "Years of experience range"},
    }

    async def execute(self, input_data):
        role = self.config.get("role", "Software Engineer")
        skills = self.config.get("skills", [])
        location = self.config.get("location", "")
        experience = self.config.get("experience_range", "2-5")

        try:
            llm = get_llm(temperature=0.2)
            prompt = (
                f"You are a technical recruiter planning a sourcing strategy.\n"
                f"Role: {role}\n"
                f"Required skills: {', '.join(skills)}\n"
                f"Location: {location or 'any'}\n"
                f"Experience: {experience} years\n\n"
                f"Return a JSON object with these fields:\n"
                f"- search_queries: object with keys 'github', 'tavily', 'stackoverflow' and optimized search query strings as values\n"
                f"- recommended_sources: array of recommended source names\n"
                f"- strategy: a 1-2 sentence sourcing strategy\n"
                f"Return ONLY valid JSON, no markdown."
            )
            response = await llm.ainvoke(prompt)
            text = response.content.strip()
            # Strip markdown fences if present
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            parsed = json.loads(text)

            return {
                "role": role,
                "skills": skills,
                "location": location,
                "experience_range": experience,
                "search_queries": parsed.get("search_queries", {}),
                "recommended_sources": parsed.get("recommended_sources", ["github", "tavily"]),
                "strategy": parsed.get("strategy", ""),
            }
        except Exception as e:
            logger.warning("LLM source planning failed, using fallback: %s", e)
            search_queries = {
                "github": f"{' '.join(skills[:3])} {'location:' + location if location else ''}".strip(),
                "tavily": f"site:linkedin.com {role} {' '.join(skills[:2])} {location}".strip(),
                "stackoverflow": f"{' '.join(skills[:2])}".strip(),
            }
            return {
                "role": role,
                "skills": skills,
                "location": location,
                "experience_range": experience,
                "search_queries": search_queries,
                "recommended_sources": ["github", "tavily"],
                "strategy": f"Search for {role} with skills {', '.join(skills)} in {location or 'any location'}",
            }


class AICandidateScoringNode(BaseNode):
    node_type = "ai_candidate_scoring"
    category = "ai"
    display_name = "AI Candidate Scoring"
    description = "Score candidates against job requirements using AI"
    config_schema = {
        "required_skills": {"type": "array", "description": "Skills required for the role"},
        "role": {"type": "string", "description": "Target role for scoring context"},
    }

    async def execute(self, input_data):
        leads = self._collect_leads(input_data)
        required_skills = self.config.get("required_skills", [])
        role = self.config.get("role", "Software Engineer")

        # Try LLM-based scoring for richer evaluation
        try:
            llm = get_llm(temperature=0)
            scored_leads = []
            # Batch leads to avoid excessive LLM calls (max 10 at a time)
            for i in range(0, len(leads), 10):
                batch = leads[i:i + 10]
                summaries = []
                for idx, lead in enumerate(batch):
                    summaries.append(
                        f"{idx + 1}. Name: {lead.get('name', 'Unknown')}, "
                        f"Skills: {', '.join(lead.get('skills') or [])}, "
                        f"Headline: {lead.get('headline', '')[:100]}, "
                        f"Source: {lead.get('source', '')}"
                    )

                prompt = (
                    f"Score these candidates for a {role} position requiring: {', '.join(required_skills)}.\n\n"
                    f"Candidates:\n" + "\n".join(summaries) + "\n\n"
                    f"Return a JSON array where each element has:\n"
                    f"- index: candidate number (1-based)\n"
                    f"- score: 0-100 overall fit score\n"
                    f"- skill_match: 0-50 skill relevance\n"
                    f"- potential: 0-25 growth potential\n"
                    f"- completeness: 0-25 profile quality\n"
                    f"- reasoning: 1 sentence explanation\n"
                    f"Return ONLY valid JSON array, no markdown."
                )
                response = await llm.ainvoke(prompt)
                text = response.content.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                scores = json.loads(text)

                for score_data in scores:
                    idx = score_data.get("index", 1) - 1
                    if 0 <= idx < len(batch):
                        lead = batch[idx]
                        scored_leads.append({
                            **lead,
                            "score": score_data.get("score", 50),
                            "score_breakdown": {
                                "skill_match": score_data.get("skill_match", 25),
                                "potential": score_data.get("potential", 12),
                                "completeness": score_data.get("completeness", 12),
                            },
                            "ai_reasoning": score_data.get("reasoning", ""),
                        })

            scored_leads.sort(key=lambda x: x["score"], reverse=True)
            return {"leads": scored_leads, "count": len(scored_leads), "source": "scoring"}

        except Exception as e:
            logger.warning("LLM scoring failed, using arithmetic fallback: %s", e)

        # Arithmetic fallback
        scored_leads = []
        for lead in leads:
            lead_skills = [s.lower() for s in (lead.get("skills") or [])]
            required_lower = [s.lower() for s in required_skills]

            if required_lower:
                matches = sum(1 for s in required_lower if any(s in ls for ls in lead_skills))
                skill_score = (matches / len(required_lower)) * 50
            else:
                skill_score = 25

            raw = lead.get("raw_data", {})
            repos = raw.get("repos", 0)
            followers = raw.get("followers", 0)
            reputation = raw.get("reputation", 0)
            answer_count = raw.get("answer_count", 0)
            activity_score = min(25, repos * 0.5 + followers * 0.3 + reputation * 0.001 + answer_count * 0.2)

            completeness = 0
            if lead.get("name"):
                completeness += 5
            if lead.get("email"):
                completeness += 10
            if lead.get("location"):
                completeness += 5
            if lead.get("headline"):
                completeness += 5

            total_score = round(skill_score + activity_score + completeness, 1)
            scored_leads.append({
                **lead,
                "score": total_score,
                "score_breakdown": {
                    "skill_match": round(skill_score, 1),
                    "activity": round(activity_score, 1),
                    "completeness": round(completeness, 1),
                },
            })

        scored_leads.sort(key=lambda x: x["score"], reverse=True)
        return {"leads": scored_leads, "count": len(scored_leads), "source": "scoring"}


class AIProfileExtractorNode(BaseNode):
    node_type = "ai_profile_extractor"
    category = "ai"
    display_name = "AI Profile Extractor"
    description = "Extract structured data from raw profile information"
    config_schema = {}

    async def execute(self, input_data):
        leads = self._collect_leads(input_data)

        # Try LLM-based extraction for richer profiles
        try:
            llm = get_llm(temperature=0)
            extracted_leads = []

            for i in range(0, len(leads), 10):
                batch = leads[i:i + 10]
                profiles = []
                for idx, lead in enumerate(batch):
                    raw = lead.get("raw_data", {})
                    profiles.append(
                        f"{idx + 1}. Name: {lead.get('name', 'Unknown')}, "
                        f"Headline: {lead.get('headline', '')[:150]}, "
                        f"Source: {lead.get('source', '')}, "
                        f"Location: {lead.get('location', '')}, "
                        f"Repos: {raw.get('repos', 'N/A')}, "
                        f"Reputation: {raw.get('reputation', 'N/A')}, "
                        f"Content: {raw.get('content_snippet', '')[:200]}"
                    )

                prompt = (
                    f"Extract structured profile info from these raw candidate profiles.\n\n"
                    + "\n".join(profiles) + "\n\n"
                    f"Return a JSON array where each element has:\n"
                    f"- index: candidate number (1-based)\n"
                    f"- name: cleaned full name\n"
                    f"- headline: professional headline (1 sentence)\n"
                    f"- location: location if identifiable\n"
                    f"- experience_years: estimated years of experience (number)\n"
                    f"- skills: array of inferred technical skills\n"
                    f"Return ONLY valid JSON array, no markdown."
                )
                response = await llm.ainvoke(prompt)
                text = response.content.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                extractions = json.loads(text)

                for ext in extractions:
                    idx = ext.get("index", 1) - 1
                    if 0 <= idx < len(batch):
                        lead = batch[idx]
                        raw = lead.get("raw_data", {})
                        extracted_leads.append({
                            **lead,
                            "name": ext.get("name") or lead.get("name", "Unknown"),
                            "headline": ext.get("headline") or lead.get("headline", ""),
                            "location": ext.get("location") or lead.get("location", ""),
                            "experience_years": ext.get("experience_years", 0),
                            "skills": ext.get("skills") or lead.get("skills", []),
                            "raw_data": {**raw, "extraction_applied": True},
                        })

            return {"leads": extracted_leads, "count": len(extracted_leads), "source": "extraction"}

        except Exception as e:
            logger.warning("LLM extraction failed, using heuristic fallback: %s", e)

        # Heuristic fallback
        extracted_leads = []
        for lead in leads:
            raw = lead.get("raw_data", {})
            name = lead.get("name") or raw.get("display_name") or raw.get("login", "Unknown")
            email = lead.get("email") or raw.get("email")
            location = lead.get("location") or raw.get("location", "")
            headline = lead.get("headline") or raw.get("bio", "")

            repos = raw.get("repos", 0)
            reputation = raw.get("reputation", 0)
            estimated_years = 0.0
            if repos > 50 or reputation > 10000:
                estimated_years = 8.0
            elif repos > 20 or reputation > 5000:
                estimated_years = 5.0
            elif repos > 5 or reputation > 1000:
                estimated_years = 3.0
            elif repos > 0 or reputation > 0:
                estimated_years = 1.0

            extracted_leads.append({
                **lead,
                "name": name,
                "email": email,
                "location": location,
                "headline": headline,
                "experience_years": estimated_years,
                "raw_data": {**raw, "extraction_applied": True},
            })

        return {"leads": extracted_leads, "count": len(extracted_leads), "source": "extraction"}
