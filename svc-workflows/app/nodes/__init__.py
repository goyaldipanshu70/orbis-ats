from app.nodes.trigger_nodes import ManualTriggerNode, CronTriggerNode
from app.nodes.search_nodes import GitHubSearchNode, TavilySearchNode, StackOverflowSearchNode
from app.nodes.ai_nodes import AISourcePlannerNode, AICandidateScoringNode, AIProfileExtractorNode
from app.nodes.processing_nodes import FilterNode, DeduplicateNode, RankCandidatesNode
from app.nodes.action_nodes import SaveToTalentPoolNode, AddToEmailCampaignNode, NotifyHRNode

NODE_REGISTRY = {
    "manual_trigger": ManualTriggerNode,
    "cron_trigger": CronTriggerNode,
    "github_search": GitHubSearchNode,
    "google_search": TavilySearchNode,  # backwards-compat: old workflows using google_search use Tavily
    "tavily_search": TavilySearchNode,
    "stackoverflow_search": StackOverflowSearchNode,
    "ai_source_planner": AISourcePlannerNode,
    "ai_candidate_scoring": AICandidateScoringNode,
    "ai_profile_extractor": AIProfileExtractorNode,
    "filter": FilterNode,
    "deduplicate": DeduplicateNode,
    "rank_candidates": RankCandidatesNode,
    "save_to_talent_pool": SaveToTalentPoolNode,
    "add_to_email_campaign": AddToEmailCampaignNode,
    "notify_hr": NotifyHRNode,
}
