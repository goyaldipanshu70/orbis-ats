from app.nodes.base import BaseNode
from datetime import datetime


class ManualTriggerNode(BaseNode):
    node_type = "manual_trigger"
    category = "trigger"
    display_name = "Manual Trigger"
    description = "Manually trigger a workflow run"
    config_schema = {}

    async def execute(self, input_data):
        return {
            "triggered_at": datetime.utcnow().isoformat(),
            "trigger_type": "manual",
            "config": self.config,
        }


class CronTriggerNode(BaseNode):
    node_type = "cron_trigger"
    category = "trigger"
    display_name = "Scheduled Trigger"
    description = "Trigger workflow on a schedule"
    config_schema = {
        "cron_expression": {"type": "string", "default": "0 9 * * 1", "description": "Cron expression for schedule"},
    }

    async def execute(self, input_data):
        return {
            "triggered_at": datetime.utcnow().isoformat(),
            "trigger_type": "cron",
            "schedule": self.config.get("cron_expression", "0 9 * * 1"),
        }
