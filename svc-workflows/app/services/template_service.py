WORKFLOW_TEMPLATES = [
    {
        "id": "github-talent-search",
        "name": "GitHub Talent Search",
        "description": "Find developers on GitHub matching your job requirements",
        "category": "sourcing",
        "definition_json": {
            "nodes": [
                {"id": "trigger-1", "type": "manual_trigger", "position": {"x": 50, "y": 200}, "data": {"label": "Manual Trigger", "config": {}}},
                {"id": "planner-1", "type": "ai_source_planner", "position": {"x": 300, "y": 200}, "data": {"label": "AI Source Planner", "config": {"role": "Software Engineer", "skills": ["Python", "React", "AWS"], "location": ""}}},
                {"id": "github-1", "type": "github_search", "position": {"x": 550, "y": 200}, "data": {"label": "GitHub Search", "config": {"max_results": 20}}},
                {"id": "score-1", "type": "ai_candidate_scoring", "position": {"x": 800, "y": 200}, "data": {"label": "AI Scoring", "config": {"required_skills": ["Python", "React"]}}},
                {"id": "filter-1", "type": "filter", "position": {"x": 1050, "y": 200}, "data": {"label": "Filter Score > 50", "config": {"min_score": 50}}},
                {"id": "save-1", "type": "save_to_talent_pool", "position": {"x": 1300, "y": 200}, "data": {"label": "Save to Talent Pool", "config": {}}},
            ],
            "edges": [
                ["trigger-1", "planner-1"],
                ["planner-1", "github-1"],
                ["github-1", "score-1"],
                ["score-1", "filter-1"],
                ["filter-1", "save-1"],
            ],
        },
    },
    {
        "id": "multi-source-pipeline",
        "name": "Multi-Source Talent Pipeline",
        "description": "Search GitHub and StackOverflow in parallel, merge and score results",
        "category": "sourcing",
        "definition_json": {
            "nodes": [
                {"id": "trigger-1", "type": "manual_trigger", "position": {"x": 50, "y": 300}, "data": {"label": "Manual Trigger", "config": {}}},
                {"id": "planner-1", "type": "ai_source_planner", "position": {"x": 300, "y": 300}, "data": {"label": "AI Source Planner", "config": {"role": "Full Stack Developer", "skills": ["JavaScript", "Node.js", "React"], "location": ""}}},
                {"id": "github-1", "type": "github_search", "position": {"x": 600, "y": 150}, "data": {"label": "GitHub Search", "config": {"max_results": 15}}},
                {"id": "stackoverflow-1", "type": "stackoverflow_search", "position": {"x": 600, "y": 450}, "data": {"label": "StackOverflow Search", "config": {"max_results": 15}}},
                {"id": "dedup-1", "type": "deduplicate", "position": {"x": 900, "y": 300}, "data": {"label": "Deduplicate", "config": {}}},
                {"id": "score-1", "type": "ai_candidate_scoring", "position": {"x": 1150, "y": 300}, "data": {"label": "AI Scoring", "config": {"required_skills": ["JavaScript", "React"]}}},
                {"id": "filter-1", "type": "filter", "position": {"x": 1400, "y": 300}, "data": {"label": "Filter Top Candidates", "config": {"min_score": 60}}},
                {"id": "save-1", "type": "save_to_talent_pool", "position": {"x": 1650, "y": 300}, "data": {"label": "Save Results", "config": {}}},
            ],
            "edges": [
                ["trigger-1", "planner-1"],
                ["planner-1", "github-1"],
                ["planner-1", "stackoverflow-1"],
                ["github-1", "dedup-1"],
                ["stackoverflow-1", "dedup-1"],
                ["dedup-1", "score-1"],
                ["score-1", "filter-1"],
                ["filter-1", "save-1"],
            ],
        },
    },
    {
        "id": "score-and-outreach",
        "name": "Score & Outreach Pipeline",
        "description": "Search candidates, score them, and automatically start email outreach",
        "category": "outreach",
        "definition_json": {
            "nodes": [
                {"id": "trigger-1", "type": "manual_trigger", "position": {"x": 50, "y": 250}, "data": {"label": "Manual Trigger", "config": {}}},
                {"id": "github-1", "type": "github_search", "position": {"x": 300, "y": 250}, "data": {"label": "GitHub Search", "config": {"skills": ["Python", "Django"], "max_results": 20}}},
                {"id": "score-1", "type": "ai_candidate_scoring", "position": {"x": 550, "y": 250}, "data": {"label": "Score Candidates", "config": {"required_skills": ["Python", "Django"]}}},
                {"id": "filter-1", "type": "filter", "position": {"x": 800, "y": 250}, "data": {"label": "Filter Score > 70", "config": {"min_score": 70, "has_email": True}}},
                {"id": "save-1", "type": "save_to_talent_pool", "position": {"x": 1050, "y": 150}, "data": {"label": "Save to Pool", "config": {}}},
                {"id": "outreach-1", "type": "add_to_email_campaign", "position": {"x": 1050, "y": 350}, "data": {"label": "Start Outreach", "config": {}}},
            ],
            "edges": [
                ["trigger-1", "github-1"],
                ["github-1", "score-1"],
                ["score-1", "filter-1"],
                ["filter-1", "save-1"],
                ["filter-1", "outreach-1"],
            ],
        },
    },
    {
        "id": "linkedin-smart-pipeline",
        "name": "LinkedIn Smart Pipeline",
        "description": "Search LinkedIn for candidates, score them, and conditionally route top talent to pool + outreach",
        "category": "sourcing",
        "definition_json": {
            "nodes": [
                {"id": "trigger-1", "type": "manual_trigger", "position": {"x": 50, "y": 300}, "data": {"label": "Manual Trigger", "config": {}}},
                {"id": "linkedin-1", "type": "linkedin_search", "position": {"x": 300, "y": 300}, "data": {"label": "LinkedIn Search", "config": {"role": "Software Engineer", "skills": ["Python", "AWS"], "location": "", "max_results": 20}}},
                {"id": "extract-1", "type": "ai_profile_extractor", "position": {"x": 550, "y": 300}, "data": {"label": "Extract Profiles", "config": {}}},
                {"id": "score-1", "type": "ai_candidate_scoring", "position": {"x": 800, "y": 300}, "data": {"label": "AI Scoring", "config": {"required_skills": ["Python", "AWS"]}}},
                {"id": "branch-1", "type": "conditional", "position": {"x": 1050, "y": 300}, "data": {"label": "Score >= 70?", "config": {"condition_type": "score_threshold", "threshold": 70}}},
                {"id": "save-1", "type": "save_to_talent_pool", "position": {"x": 1300, "y": 180}, "data": {"label": "Save Top Talent", "config": {}}},
                {"id": "outreach-1", "type": "add_to_email_campaign", "position": {"x": 1300, "y": 420}, "data": {"label": "Cold Outreach", "config": {"campaign_name": "LinkedIn Sourcing", "email_subject": "Exciting opportunity at our company, {name}", "email_body": "<p>Hi {name},</p><p>I came across your profile and was impressed by your experience as {role}. We have an exciting opportunity that aligns with your background.</p><p>Would you be open to a brief conversation?</p>"}}},
            ],
            "edges": [
                ["trigger-1", "linkedin-1"],
                ["linkedin-1", "extract-1"],
                ["extract-1", "score-1"],
                ["score-1", "branch-1"],
                ["branch-1", "save-1", "true"],
                ["branch-1", "outreach-1", "true"],
            ],
        },
    },
    {
        "id": "full-spectrum-sourcing",
        "name": "Full Spectrum Sourcing",
        "description": "Search GitHub, LinkedIn, and StackOverflow in parallel, deduplicate, score, and auto-onboard",
        "category": "sourcing",
        "definition_json": {
            "nodes": [
                {"id": "trigger-1", "type": "manual_trigger", "position": {"x": 50, "y": 300}, "data": {"label": "Manual Trigger", "config": {}}},
                {"id": "planner-1", "type": "ai_source_planner", "position": {"x": 300, "y": 300}, "data": {"label": "AI Source Planner", "config": {"role": "Backend Engineer", "skills": ["Python", "Go", "Kubernetes"], "location": ""}}},
                {"id": "github-1", "type": "github_search", "position": {"x": 600, "y": 100}, "data": {"label": "GitHub Search", "config": {"max_results": 15}}},
                {"id": "linkedin-1", "type": "linkedin_search", "position": {"x": 600, "y": 300}, "data": {"label": "LinkedIn Search", "config": {"max_results": 15}}},
                {"id": "stackoverflow-1", "type": "stackoverflow_search", "position": {"x": 600, "y": 500}, "data": {"label": "StackOverflow Search", "config": {"max_results": 15}}},
                {"id": "dedup-1", "type": "deduplicate", "position": {"x": 900, "y": 300}, "data": {"label": "Deduplicate", "config": {}}},
                {"id": "extract-1", "type": "ai_profile_extractor", "position": {"x": 1100, "y": 300}, "data": {"label": "Extract Profiles", "config": {}}},
                {"id": "score-1", "type": "ai_candidate_scoring", "position": {"x": 1300, "y": 300}, "data": {"label": "AI Scoring", "config": {"required_skills": ["Python", "Go", "Kubernetes"]}}},
                {"id": "rank-1", "type": "rank_candidates", "position": {"x": 1500, "y": 300}, "data": {"label": "Top 20", "config": {"top_n": 20}}},
                {"id": "save-1", "type": "save_to_talent_pool", "position": {"x": 1700, "y": 200}, "data": {"label": "Save to Talent Pool", "config": {}}},
                {"id": "notify-1", "type": "notify_hr", "position": {"x": 1700, "y": 400}, "data": {"label": "Notify HR", "config": {"channel": "email"}}},
            ],
            "edges": [
                ["trigger-1", "planner-1"],
                ["planner-1", "github-1"],
                ["planner-1", "linkedin-1"],
                ["planner-1", "stackoverflow-1"],
                ["github-1", "dedup-1"],
                ["linkedin-1", "dedup-1"],
                ["stackoverflow-1", "dedup-1"],
                ["dedup-1", "extract-1"],
                ["extract-1", "score-1"],
                ["score-1", "rank-1"],
                ["rank-1", "save-1"],
                ["rank-1", "notify-1"],
            ],
        },
    },
]


def get_templates():
    return WORKFLOW_TEMPLATES


def get_template_by_id(template_id: str):
    for t in WORKFLOW_TEMPLATES:
        if t["id"] == template_id:
            return t
    return None
