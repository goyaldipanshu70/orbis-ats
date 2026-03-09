import logging
import asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Workflow, WorkflowRun, WorkflowNodeRun, ScrapedLead

logger = logging.getLogger("svc-workflows")


class ExecutionEngine:
    """Executes a workflow DAG by topologically sorting nodes and running them."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._node_registry = {}
        self._register_nodes()

    def _register_nodes(self):
        from app.nodes import NODE_REGISTRY
        self._node_registry = NODE_REGISTRY

    async def execute(self, workflow: Workflow, run: WorkflowRun, input_data: dict = None):
        """Execute all nodes in topological order."""
        try:
            definition = workflow.definition_json or {}
            nodes = definition.get("nodes", [])
            edges = definition.get("edges", [])

            # Update run status
            run.status = "running"
            run.started_at = datetime.utcnow()
            await self.db.commit()

            # Build adjacency list and in-degree map
            adj = {}
            in_degree = {}
            node_map = {}
            for node in nodes:
                nid = node["id"]
                adj[nid] = []
                in_degree[nid] = 0
                node_map[nid] = node

            for edge in edges:
                src, dst = edge[0], edge[1]
                adj[src].append(dst)
                in_degree[dst] = in_degree.get(dst, 0) + 1

            # Identify leaf nodes (no outgoing edges) — only these persist leads
            leaf_nodes = {nid for nid, neighbors in adj.items() if len(neighbors) == 0}

            # Topological sort (Kahn's algorithm)
            queue = [nid for nid, deg in in_degree.items() if deg == 0]
            exec_order = []
            while queue:
                current_batch = list(queue)
                queue = []
                exec_order.append(current_batch)
                for nid in current_batch:
                    for neighbor in adj.get(nid, []):
                        in_degree[neighbor] -= 1
                        if in_degree[neighbor] == 0:
                            queue.append(neighbor)

            # Execute batches
            node_outputs = {}
            if input_data:
                node_outputs["_input"] = input_data

            for batch in exec_order:
                tasks = []
                for node_id in batch:
                    node_def = node_map[node_id]
                    is_leaf = node_id in leaf_nodes
                    tasks.append(self._execute_node(run, node_id, node_def, node_outputs, persist_leads=is_leaf))
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for node_id, result in zip(batch, results):
                    if isinstance(result, Exception):
                        node_outputs[node_id] = {"error": str(result)}
                        logger.error(f"Node {node_id} failed: {result}")
                    else:
                        node_outputs[node_id] = result

            # Complete run
            run.status = "completed"
            run.output_data = {k: v for k, v in node_outputs.items() if k != "_input"}
            run.completed_at = datetime.utcnow()
            await self.db.commit()

        except Exception as e:
            run.status = "failed"
            run.error_message = str(e)
            run.completed_at = datetime.utcnow()
            await self.db.commit()
            logger.exception(f"Workflow run {run.id} failed")

    async def _execute_node(self, run: WorkflowRun, node_id: str, node_def: dict, node_outputs: dict, persist_leads: bool = False):
        """Execute a single node. Only persist leads to DB if persist_leads=True (leaf nodes)."""
        node_type = node_def.get("type", "unknown")
        node_config = node_def.get("data", {}).get("config", {})

        # Create node run record
        node_run = WorkflowNodeRun(
            run_id=run.id,
            node_id=node_id,
            node_type=node_type,
            status="running",
            started_at=datetime.utcnow(),
        )
        self.db.add(node_run)
        await self.db.flush()

        try:
            # Gather inputs from connected upstream nodes
            definition = run.workflow.definition_json or {}
            edges = definition.get("edges", [])
            input_data = {}
            for edge in edges:
                if edge[1] == node_id:
                    src_id = edge[0]
                    if src_id in node_outputs:
                        src_output = node_outputs[src_id]
                        # Handle conditional branching
                        edge_label = edge[2] if len(edge) > 2 else None
                        if edge_label and isinstance(src_output, dict):
                            branch_key = f"{edge_label}_leads"
                            if branch_key in src_output:
                                input_data[src_id] = {"leads": src_output[branch_key]}
                            else:
                                input_data[src_id] = src_output
                        else:
                            input_data[src_id] = src_output
            # Merge with global input
            if "_input" in node_outputs:
                input_data["_input"] = node_outputs["_input"]

            node_run.input_data = input_data

            # Get node executor
            executor_cls = self._node_registry.get(node_type)
            if not executor_cls:
                raise ValueError(f"Unknown node type: {node_type}")

            executor = executor_cls(config=node_config, db=self.db, run=run)
            result = await executor.execute(input_data)

            # Only persist leads for leaf nodes to avoid duplicates
            if persist_leads:
                leads = result.get("leads", [])
                if leads:
                    for lead_data in leads:
                        lead = ScrapedLead(
                            workflow_run_id=run.id,
                            name=lead_data.get("name"),
                            email=lead_data.get("email"),
                            linkedin_url=lead_data.get("linkedin_url"),
                            github_url=lead_data.get("github_url"),
                            portfolio_url=lead_data.get("portfolio_url"),
                            headline=lead_data.get("headline"),
                            location=lead_data.get("location"),
                            skills=lead_data.get("skills"),
                            experience_years=lead_data.get("experience_years"),
                            source=lead_data.get("source"),
                            source_url=lead_data.get("source_url"),
                            score=lead_data.get("score"),
                            score_breakdown=lead_data.get("score_breakdown"),
                            raw_data=lead_data.get("raw_data"),
                        )
                        self.db.add(lead)

            node_run.status = "completed"
            node_run.output_data = result
            node_run.completed_at = datetime.utcnow()
            node_run.execution_time_ms = int(
                (node_run.completed_at - node_run.started_at).total_seconds() * 1000
            )
            await self.db.flush()
            return result

        except Exception as e:
            node_run.status = "failed"
            node_run.error_message = str(e)
            node_run.completed_at = datetime.utcnow()
            await self.db.flush()
            raise
