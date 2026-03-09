from abc import ABC, abstractmethod
from typing import Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession


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
        """Collect leads from upstream node outputs."""
        leads = []
        for key, value in input_data.items():
            if key == "_input":
                continue
            if isinstance(value, dict) and "leads" in value:
                leads.extend(value["leads"])
        return leads
