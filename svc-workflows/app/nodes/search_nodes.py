import asyncio
import logging
import httpx
from app.nodes.base import BaseNode
from app.core.config import settings
from app.utils.retry import retry_async, safe_parse_json, is_safe_url

logger = logging.getLogger("svc-workflows")

LLM_TIMEOUT_SECONDS = 60


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
        if isinstance(skills, str):
            skills = [s.strip() for s in skills.split(",") if s.strip()]
        location = self.config.get("location") or planner_data.get("location", "")
        max_results = int(self.config.get("max_results", 10))

        query_parts = []
        if skills:
            query_parts.append(" ".join(skills[:3]))
        if location:
            query_parts.append(f'location:"{location}"')

        query = " ".join(query_parts) if query_parts else "developer"

        leads = []
        headers = {"Accept": "application/vnd.github.v3+json"}
        token = settings.GITHUB_TOKEN
        if token:
            headers["Authorization"] = f"token {token}"

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await retry_async(
                    lambda: client.get(
                        "https://api.github.com/search/users",
                        params={"q": query, "per_page": min(max_results, 30)},
                        headers=headers,
                    ),
                    max_retries=2, label="GitHub search",
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data.get("items", [])[:max_results]:
                        try:
                            profile_resp = await client.get(item["url"], headers=headers)
                            profile = profile_resp.json() if profile_resp.status_code == 200 else {}
                        except Exception:
                            profile = {}

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
                elif resp.status_code == 403:
                    logger.warning("GitHub API rate limited: %s", resp.text[:200])
                    return {"leads": [], "count": 0, "source": "github", "error": "GitHub API rate limit exceeded"}
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
        if isinstance(skills, str):
            skills = [s.strip() for s in skills.split(",") if s.strip()]
        location = self.config.get("location") or planner_data.get("location", "")
        max_results = int(self.config.get("max_results", 10))

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
        if isinstance(skills, str):
            skills = [s.strip() for s in skills.split(",") if s.strip()]
        min_reputation = int(self.config.get("min_reputation", 1000))
        max_results = int(self.config.get("max_results", 10))

        tag = skills[0] if skills else "python"

        leads = []
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await retry_async(
                    lambda: client.get(
                        "https://api.stackexchange.com/2.3/tags/{}/top-answerers/all_time".format(tag),
                        params={
                            "site": "stackoverflow",
                            "pagesize": min(max_results, 20),
                        },
                    ),
                    max_retries=2, label="StackOverflow search",
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


class LinkedInSearchNode(BaseNode):
    node_type = "linkedin_search"
    category = "search"
    display_name = "LinkedIn Search"
    description = "Search for candidate profiles on LinkedIn via web search"
    config_schema = {
        "role": {"type": "string", "description": "Target role or job title"},
        "skills": {"type": "array", "description": "Skills to search for"},
        "location": {"type": "string", "description": "Location filter"},
        "company": {"type": "string", "description": "Company filter (optional)"},
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

        role = self.config.get("role") or planner_data.get("role", "Software Engineer")
        skills = self.config.get("skills") or planner_data.get("skills", [])
        if isinstance(skills, str):
            skills = [s.strip() for s in skills.split(",") if s.strip()]
        location = self.config.get("location") or planner_data.get("location", "")
        company = self.config.get("company", "")
        max_results = int(self.config.get("max_results", 10))

        tavily_key = settings.TAVILY_API_KEY
        if not tavily_key:
            logger.warning("TAVILY_API_KEY not configured — returning empty results")
            return {"leads": [], "count": 0, "source": "linkedin", "error": "TAVILY_API_KEY not set"}

        # Build multiple targeted queries for LinkedIn
        queries = []
        if role and skills:
            skill_str = " ".join(f'"{s}"' for s in skills[:3])
            queries.append(f'site:linkedin.com/in "{role}" {skill_str}')
        if role and company:
            queries.append(f'site:linkedin.com/in "{role}" "{company}"')
        if role and location:
            queries.append(f'site:linkedin.com/in "{role}" "{location}"')
        if not queries:
            queries.append(f'site:linkedin.com/in "{role}"')

        leads = []
        seen_urls = set()
        try:
            from tavily import TavilyClient
            client = TavilyClient(api_key=tavily_key)

            for query in queries:
                if len(leads) >= max_results:
                    break
                remaining = max_results - len(leads)
                response = client.search(
                    query=query,
                    max_results=min(remaining, 10),
                    search_depth="advanced",
                    include_raw_content=False,
                )
                for result in response.get("results", []):
                    url = result.get("url", "")
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)

                    title = result.get("title", "")
                    content = result.get("content", "")

                    # Extract name from title (LinkedIn pattern: "Name - Title | LinkedIn")
                    name = title.split(" - ")[0].split(" | ")[0].strip() if title else "Unknown"

                    linkedin_url = url if "linkedin.com" in url else None

                    leads.append({
                        "name": name,
                        "email": None,
                        "linkedin_url": linkedin_url,
                        "headline": content[:200] if content else title,
                        "location": location or "",
                        "skills": skills,
                        "source": "linkedin",
                        "source_url": url,
                        "raw_data": {
                            "title": title,
                            "url": url,
                            "content_snippet": content[:500] if content else "",
                            "score": result.get("score"),
                            "company": company,
                        },
                    })

                    if len(leads) >= max_results:
                        break

        except Exception as e:
            logger.error("LinkedIn search failed: %s", e)
            return {"leads": [], "count": 0, "source": "linkedin", "error": str(e)}

        return {"leads": leads, "count": len(leads), "source": "linkedin"}


class WebScraperNode(BaseNode):
    node_type = "web_scraper"
    category = "search"
    display_name = "Web Scraper"
    description = "Scrape web pages to extract candidate information"
    config_schema = {
        "urls": {"type": "array", "description": "List of URLs to scrape"},
        "css_selector": {"type": "string", "description": "CSS selector to target specific content (optional)"},
        "max_pages": {"type": "integer", "default": 5, "description": "Maximum number of pages to scrape"},
    }

    async def execute(self, input_data):
        from bs4 import BeautifulSoup
        from app.core.llm_provider import get_llm

        planner_data = {}
        for key, value in input_data.items():
            if key == "_input":
                continue
            if isinstance(value, dict) and "search_queries" in value:
                planner_data = value
                break

        urls = self.config.get("urls") or planner_data.get("urls", [])
        css_selector = self.config.get("css_selector", "")
        max_pages = int(self.config.get("max_pages", 5))

        if not urls:
            return {"leads": [], "count": 0, "source": "web_scraper", "error": "No URLs provided"}

        # Filter out unsafe URLs (SSRF prevention)
        urls = [u for u in urls if is_safe_url(u)]
        if not urls:
            return {"leads": [], "count": 0, "source": "web_scraper", "error": "No safe URLs provided"}

        urls = urls[:max_pages]
        all_leads = []

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            for url in urls:
                try:
                    resp = await client.get(url, headers={
                        "User-Agent": "Mozilla/5.0 (compatible; OrbisATS/1.0)"
                    })
                    if resp.status_code != 200:
                        logger.warning("Failed to fetch %s: status %s", url, resp.status_code)
                        continue

                    soup = BeautifulSoup(resp.text, "html.parser")

                    # Remove script and style elements
                    for tag in soup(["script", "style", "nav", "footer", "header"]):
                        tag.decompose()

                    if css_selector:
                        elements = soup.select(css_selector)
                        text_content = "\n".join(el.get_text(separator=" ", strip=True) for el in elements)
                    else:
                        body = soup.find("body")
                        text_content = body.get_text(separator=" ", strip=True) if body else soup.get_text(separator=" ", strip=True)

                    # Truncate to avoid exceeding LLM context limits
                    text_content = text_content[:5000]

                    if not text_content.strip():
                        continue

                    # Use LLM to extract structured candidate profiles
                    try:
                        llm = get_llm(temperature=0)
                        prompt = (
                            "Extract candidate profiles from this web page content. "
                            "Return a JSON array where each element has: "
                            "name, email, title (headline), company, location, "
                            "skills (array), source_url, linkedin_url, github_url.\n"
                            "If a field is unknown, use null. Return ONLY valid JSON array, no markdown.\n\n"
                            f"Source URL: {url}\n\n"
                            f"Content:\n{text_content}"
                        )
                        response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=LLM_TIMEOUT_SECONDS)
                        profiles = safe_parse_json(response.content)
                        if not isinstance(profiles, list):
                            raise ValueError("LLM did not return a JSON array")

                        for profile in profiles:
                            if not isinstance(profile, dict):
                                continue
                            all_leads.append({
                                "name": profile.get("name") or "Unknown",
                                "email": profile.get("email"),
                                "linkedin_url": profile.get("linkedin_url"),
                                "github_url": profile.get("github_url"),
                                "headline": profile.get("title") or profile.get("headline", ""),
                                "location": profile.get("location", ""),
                                "skills": profile.get("skills") or [],
                                "source": "web_scraper",
                                "source_url": profile.get("source_url") or url,
                                "raw_data": {
                                    "company": profile.get("company"),
                                    "scraped_from": url,
                                },
                            })
                    except Exception as llm_err:
                        logger.warning("LLM extraction failed for %s, using basic fallback: %s", url, llm_err)
                        # Basic fallback: return raw text as a single lead
                        all_leads.append({
                            "name": "Unknown",
                            "email": None,
                            "linkedin_url": None,
                            "headline": text_content[:200],
                            "location": "",
                            "skills": [],
                            "source": "web_scraper",
                            "source_url": url,
                            "raw_data": {
                                "scraped_from": url,
                                "raw_text": text_content[:1000],
                            },
                        })

                except Exception as e:
                    logger.error("Failed to scrape %s: %s", url, e)
                    continue

        return {"leads": all_leads, "count": len(all_leads), "source": "web_scraper"}


class CustomSearchNode(BaseNode):
    node_type = "custom_search"
    category = "search"
    display_name = "Custom Source Search"
    description = "Search any website or job board using a custom URL pattern"
    config_schema = {
        "url_template": {"type": "string", "description": "URL template with {query}, {skills}, {location} placeholders"},
        "query": {"type": "string", "description": "Search query"},
        "skills": {"type": "array", "description": "Skills to search for"},
        "location": {"type": "string", "description": "Location filter"},
        "max_results": {"type": "integer", "default": 10, "description": "Maximum number of results"},
    }

    async def execute(self, input_data):
        from bs4 import BeautifulSoup
        from app.core.llm_provider import get_llm

        planner_data = {}
        for key, value in input_data.items():
            if key == "_input":
                continue
            if isinstance(value, dict) and "search_queries" in value:
                planner_data = value
                break

        url_template = self.config.get("url_template", "")
        query = self.config.get("query") or planner_data.get("role", "")
        skills = self.config.get("skills") or planner_data.get("skills", [])
        if isinstance(skills, str):
            skills = [s.strip() for s in skills.split(",") if s.strip()]
        location = self.config.get("location") or planner_data.get("location", "")
        max_results = int(self.config.get("max_results", 10))

        # If no url_template, fall back to Tavily search
        if not url_template:
            tavily_key = settings.TAVILY_API_KEY
            if not tavily_key:
                logger.warning("No url_template and TAVILY_API_KEY not configured")
                return {"leads": [], "count": 0, "source": "custom", "error": "No url_template and TAVILY_API_KEY not set"}

            search_query = query
            if skills:
                search_query += " " + " ".join(skills[:3])
            if location:
                search_query += " " + location

            leads = []
            try:
                from tavily import TavilyClient
                client = TavilyClient(api_key=tavily_key)
                response = client.search(
                    query=search_query.strip(),
                    max_results=min(max_results, 20),
                    search_depth="advanced",
                    include_raw_content=False,
                )
                for result in response.get("results", [])[:max_results]:
                    url = result.get("url", "")
                    title = result.get("title", "")
                    content = result.get("content", "")
                    name = title.split(" - ")[0].split(" | ")[0].strip() if title else "Unknown"

                    leads.append({
                        "name": name,
                        "email": None,
                        "linkedin_url": url if "linkedin.com" in url else None,
                        "headline": content[:200] if content else title,
                        "location": location or "",
                        "skills": skills,
                        "source": "custom",
                        "source_url": url,
                        "raw_data": {
                            "title": title,
                            "url": url,
                            "content_snippet": content[:500] if content else "",
                            "score": result.get("score"),
                        },
                    })
            except Exception as e:
                logger.error("Custom search (Tavily fallback) failed: %s", e)
                return {"leads": [], "count": 0, "source": "custom", "error": str(e)}

            return {"leads": leads, "count": len(leads), "source": "custom"}

        # Format the URL template with safe string replacement (no .format() to prevent injection)
        formatted_url = url_template.replace("{query}", query or "")
        formatted_url = formatted_url.replace("{skills}", "+".join(skills) if skills else "")
        formatted_url = formatted_url.replace("{location}", location or "")

        if not is_safe_url(formatted_url):
            return {"leads": [], "count": 0, "source": "custom", "error": "URL targets a private/internal network"}

        leads = []
        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                resp = await client.get(formatted_url, headers={
                    "User-Agent": "Mozilla/5.0 (compatible; OrbisATS/1.0)"
                })
                if resp.status_code != 200:
                    logger.warning("Custom search URL returned %s: %s", resp.status_code, formatted_url)
                    return {"leads": [], "count": 0, "source": "custom", "error": f"HTTP {resp.status_code}"}

                soup = BeautifulSoup(resp.text, "html.parser")

                # Remove non-content elements
                for tag in soup(["script", "style", "nav", "footer", "header"]):
                    tag.decompose()

                body = soup.find("body")
                text_content = body.get_text(separator=" ", strip=True) if body else soup.get_text(separator=" ", strip=True)
                text_content = text_content[:5000]

                if not text_content.strip():
                    return {"leads": [], "count": 0, "source": "custom", "error": "No content extracted"}

                # Use LLM to extract structured profiles
                try:
                    llm = get_llm(temperature=0)
                    prompt = (
                        "Extract candidate profiles from this web page content. "
                        "Return a JSON array where each element has: "
                        "name, email, title (headline), company, location, "
                        "skills (array), source_url, linkedin_url, github_url.\n"
                        "If a field is unknown, use null. Return ONLY valid JSON array, no markdown.\n\n"
                        f"Source URL: {formatted_url}\n\n"
                        f"Content:\n{text_content}"
                    )
                    response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=LLM_TIMEOUT_SECONDS)
                    profiles = safe_parse_json(response.content)
                    if not isinstance(profiles, list):
                        raise ValueError("LLM did not return a JSON array")

                    for profile in profiles[:max_results]:
                        if not isinstance(profile, dict):
                            continue
                        leads.append({
                            "name": profile.get("name") or "Unknown",
                            "email": profile.get("email"),
                            "linkedin_url": profile.get("linkedin_url"),
                            "github_url": profile.get("github_url"),
                            "headline": profile.get("title") or profile.get("headline", ""),
                            "location": profile.get("location", ""),
                            "skills": profile.get("skills") or [],
                            "source": "custom",
                            "source_url": profile.get("source_url") or formatted_url,
                            "raw_data": {
                                "company": profile.get("company"),
                                "scraped_from": formatted_url,
                                "url_template": url_template,
                            },
                        })
                except Exception as llm_err:
                    logger.warning("LLM extraction failed for custom search, using fallback: %s", llm_err)
                    leads.append({
                        "name": "Unknown",
                        "email": None,
                        "linkedin_url": None,
                        "headline": text_content[:200],
                        "location": location or "",
                        "skills": skills,
                        "source": "custom",
                        "source_url": formatted_url,
                        "raw_data": {
                            "scraped_from": formatted_url,
                            "raw_text": text_content[:1000],
                            "url_template": url_template,
                        },
                    })

        except Exception as e:
            logger.error("Custom search failed: %s", e)
            return {"leads": [], "count": 0, "source": "custom", "error": str(e)}

        return {"leads": leads, "count": len(leads), "source": "custom"}
