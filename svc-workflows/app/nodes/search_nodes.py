import logging
import httpx
from app.nodes.base import BaseNode
from app.core.config import settings

logger = logging.getLogger("svc-workflows")


class GitHubSearchNode(BaseNode):
    node_type = "github_search"
    category = "search"
    display_name = "GitHub Search"
    description = "Search GitHub for developer profiles"
    config_schema = {
        "skills": {"type": "array", "description": "Skills to search for"},
        "location": {"type": "string", "description": "Location filter"},
        "max_results": {"type": "integer", "default": 10, "description": "Maximum number of results"},
    }

    async def execute(self, input_data):
        planner_data = {}
        for key, value in input_data.items():
            if key == "_input":
                continue
            if isinstance(value, dict) and "search_queries" in value:
                planner_data = value
                break

        skills = self.config.get("skills") or planner_data.get("skills", [])
        location = self.config.get("location") or planner_data.get("location", "")
        max_results = self.config.get("max_results", 10)

        query_parts = []
        if skills:
            query_parts.append(" ".join(skills[:3]))
        if location:
            query_parts.append(f"location:{location}")

        query = " ".join(query_parts) if query_parts else "developer"

        leads = []
        headers = {"Accept": "application/vnd.github.v3+json"}
        token = settings.GITHUB_TOKEN
        if token:
            headers["Authorization"] = f"token {token}"

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.get(
                    "https://api.github.com/search/users",
                    params={"q": query, "per_page": min(max_results, 30)},
                    headers=headers,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data.get("items", [])[:max_results]:
                        profile_resp = await client.get(item["url"], headers=headers)
                        profile = profile_resp.json() if profile_resp.status_code == 200 else {}

                        leads.append({
                            "name": profile.get("name") or item["login"],
                            "email": profile.get("email"),
                            "github_url": item["html_url"],
                            "headline": profile.get("bio", ""),
                            "location": profile.get("location", ""),
                            "skills": skills,
                            "source": "github",
                            "source_url": item["html_url"],
                            "raw_data": {
                                "login": item["login"],
                                "repos": profile.get("public_repos", 0),
                                "followers": profile.get("followers", 0),
                                "company": profile.get("company"),
                            },
                        })
                else:
                    logger.warning("GitHub API returned %s: %s", resp.status_code, resp.text[:200])
            except Exception as e:
                logger.error("GitHub search failed: %s", e)
                return {"leads": [], "count": 0, "source": "github", "error": str(e)}

        return {"leads": leads, "count": len(leads), "source": "github"}


class TavilySearchNode(BaseNode):
    node_type = "tavily_search"
    category = "search"
    display_name = "Web Search (Tavily)"
    description = "Search the web for candidate profiles using Tavily API"
    config_schema = {
        "query": {"type": "string", "description": "Custom search query"},
        "skills": {"type": "array", "description": "Skills to search for"},
        "location": {"type": "string", "description": "Location filter"},
        "max_results": {"type": "integer", "default": 10, "description": "Maximum number of results"},
    }

    async def execute(self, input_data):
        planner_data = {}
        for key, value in input_data.items():
            if key == "_input":
                continue
            if isinstance(value, dict) and "search_queries" in value:
                planner_data = value
                break

        query = self.config.get("query", "")
        skills = self.config.get("skills") or planner_data.get("skills", [])
        location = self.config.get("location") or planner_data.get("location", "")
        max_results = self.config.get("max_results", 10)

        if not query:
            role = planner_data.get("role", "Software Engineer")
            query = f"site:linkedin.com/in {role} {' '.join(skills[:2])} {location}".strip()

        tavily_key = settings.TAVILY_API_KEY
        if not tavily_key:
            logger.warning("TAVILY_API_KEY not configured — returning empty results")
            return {"leads": [], "count": 0, "source": "tavily", "error": "TAVILY_API_KEY not set"}

        leads = []
        try:
            from tavily import TavilyClient
            client = TavilyClient(api_key=tavily_key)
            response = client.search(
                query=query,
                max_results=min(max_results, 20),
                search_depth="advanced",
                include_raw_content=False,
            )
            for result in response.get("results", [])[:max_results]:
                url = result.get("url", "")
                title = result.get("title", "")
                content = result.get("content", "")

                # Extract name from title (LinkedIn pattern: "Name - Title | LinkedIn")
                name = title.split(" - ")[0].split(" | ")[0].strip() if title else "Unknown"

                is_linkedin = "linkedin.com" in url

                leads.append({
                    "name": name,
                    "email": None,
                    "linkedin_url": url if is_linkedin else None,
                    "headline": content[:200] if content else title,
                    "location": location or "",
                    "skills": skills,
                    "source": "tavily",
                    "source_url": url,
                    "raw_data": {
                        "title": title,
                        "url": url,
                        "content_snippet": content[:500] if content else "",
                        "score": result.get("score"),
                    },
                })
        except Exception as e:
            logger.error("Tavily search failed: %s", e)
            return {"leads": [], "count": 0, "source": "tavily", "error": str(e)}

        return {"leads": leads, "count": len(leads), "source": "tavily"}


class StackOverflowSearchNode(BaseNode):
    node_type = "stackoverflow_search"
    category = "search"
    display_name = "StackOverflow Search"
    description = "Search StackOverflow for active contributors"
    config_schema = {
        "skills": {"type": "array", "description": "Tags/skills to search for"},
        "min_reputation": {"type": "integer", "default": 1000, "description": "Minimum reputation score"},
        "max_results": {"type": "integer", "default": 10, "description": "Maximum number of results"},
    }

    async def execute(self, input_data):
        planner_data = {}
        for key, value in input_data.items():
            if key == "_input":
                continue
            if isinstance(value, dict) and "search_queries" in value:
                planner_data = value
                break

        skills = self.config.get("skills") or planner_data.get("skills", [])
        min_reputation = self.config.get("min_reputation", 1000)
        max_results = self.config.get("max_results", 10)

        tag = skills[0] if skills else "python"

        leads = []
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.get(
                    "https://api.stackexchange.com/2.3/tags/{}/top-answerers/all_time".format(tag),
                    params={
                        "site": "stackoverflow",
                        "pagesize": min(max_results, 20),
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data.get("items", [])[:max_results]:
                        user = item.get("user", {})
                        reputation = user.get("reputation", 0)
                        if reputation < min_reputation:
                            continue
                        leads.append({
                            "name": user.get("display_name", "Unknown"),
                            "email": None,
                            "linkedin_url": None,
                            "headline": f"StackOverflow top answerer in {tag} (rep: {reputation})",
                            "location": user.get("location", ""),
                            "skills": skills,
                            "source": "stackoverflow",
                            "source_url": user.get("link", ""),
                            "raw_data": {
                                "user_id": user.get("user_id"),
                                "reputation": reputation,
                                "answer_count": item.get("post_count", 0),
                                "score": item.get("score", 0),
                                "profile_image": user.get("profile_image"),
                            },
                        })
                else:
                    logger.warning("StackExchange API returned %s: %s", resp.status_code, resp.text[:200])
            except Exception as e:
                logger.error("StackOverflow search failed: %s", e)
                return {"leads": [], "count": 0, "source": "stackoverflow", "error": str(e)}

        return {"leads": leads, "count": len(leads), "source": "stackoverflow"}
