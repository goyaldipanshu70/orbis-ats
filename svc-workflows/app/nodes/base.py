import logging
from abc import ABC, abstractmethod
from typing import Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("svc-workflows")


class BaseNode(ABC):
    """Base class for all workflow nodes."""

    node_type: str = "base"
    category: str = "base"
    display_name: str = "Base Node"
    description: str = ""
    config_schema: dict = {}

    def __init__(self, config: dict = None, db: AsyncSession = None, run=None):
        self.config = config or {}
        self.db = db
        self.run = run

    @abstractmethod
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the node and return output data."""
        pass

    def _collect_leads(self, input_data: dict) -> list:
        """Collect leads from upstream node outputs, with null safety."""
        if not input_data or not isinstance(input_data, dict):
            return []
        leads = []
        for key, value in input_data.items():
            if key == "_input":
                continue
            if isinstance(value, dict) and "leads" in value:
                upstream_leads = value["leads"]
                if isinstance(upstream_leads, list):
                    for lead in upstream_leads:
                        if isinstance(lead, dict):
                            leads.append(lead)
                        else:
                            logger.warning("Skipping non-dict lead from upstream %s", key)
        return leads
