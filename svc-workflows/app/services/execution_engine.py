import logging
import asyncio
from datetime import datetime
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.models import Workflow, WorkflowRun, WorkflowNodeRun, ScrapedLead
from app.core.config import settings

logger = logging.getLogger("svc-workflows")

LEAD_BATCH_SIZE = 100


class WorkflowValidationError(Exception):
    """Raised when a workflow definition is invalid."""


class ExecutionEngine:
    """Executes a workflow DAG by topologically sorting nodes and running them."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._node_registry = {}
        self._db_lock = asyncio.Lock()  # Serialize DB operations during parallel node execution
        self._register_nodes()

    def _register_nodes(self):
        from app.nodes import NODE_REGISTRY
        self._node_registry = NODE_REGISTRY

    @staticmethod
    def validate_definition(definition: dict) -> List[str]:
        """Validate a workflow definition. Returns list of errors (empty = valid)."""
        errors = []
        if not isinstance(definition, dict):
            return ["definition must be a JSON object"]

        nodes = definition.get("nodes", [])
        edges = definition.get("edges", [])

        if not isinstance(nodes, list):
            errors.append("nodes must be a list")
            return errors
        if not isinstance(edges, list):
            errors.append("edges must be a list")
            return errors

        if not nodes:
            errors.append("Workflow must contain at least one node")
            return errors

        if len(nodes) > settings.MAX_WORKFLOW_NODES:
            errors.append(f"Too many nodes ({len(nodes)}). Maximum is {settings.MAX_WORKFLOW_NODES}")

        # Check each node has required fields
        node_ids = set()
        for i, node in enumerate(nodes):
            if not isinstance(node, dict):
                errors.append(f"Node {i} must be a JSON object")
                continue
            nid = node.get("id")
            ntype = node.get("type")
            if not nid:
                errors.append(f"Node {i} missing 'id'")
            if not ntype:
                errors.append(f"Node {i} missing 'type'")
            if nid:
                if nid in node_ids:
                    errors.append(f"Duplicate node ID: {nid}")
                node_ids.add(nid)

        # Validate edges reference existing nodes
        for i, edge in enumerate(edges):
            if not isinstance(edge, (list, tuple)) or len(edge) < 2:
                errors.append(f"Edge {i} must be a list of at least [source, target]")
                continue
            src, dst = edge[0], edge[1]
            if src not in node_ids:
                errors.append(f"Edge {i} references unknown source node: {src}")
            if dst not in node_ids:
                errors.append(f"Edge {i} references unknown target node: {dst}")

        # Detect cycles using DFS
        if node_ids and not errors:
            adj = {nid: [] for nid in node_ids}
            for edge in edges:
                if isinstance(edge, (list, tuple)) and len(edge) >= 2:
                    adj[edge[0]].append(edge[1])

            WHITE, GRAY, BLACK = 0, 1, 2
            color = {nid: WHITE for nid in node_ids}

            def has_cycle(node):
                color[node] = GRAY
                for neighbor in adj.get(node, []):
                    if color[neighbor] == GRAY:
                        return True
                    if color[neighbor] == WHITE and has_cycle(neighbor):
                        return True
                color[node] = BLACK
                return False

            for nid in node_ids:
                if color[nid] == WHITE and has_cycle(nid):
                    errors.append("Workflow contains a cycle — DAG must be acyclic")
                    break

        return errors

    async def execute(self, workflow: Workflow, run: WorkflowRun, input_data: dict = None):
        """Execute all nodes in topological order."""
        try:
            definition = workflow.definition_json or {}
            nodes = definition.get("nodes", [])
            edges = definition.get("edges", [])

            # Validate definition before executing
            validation_errors = self.validate_definition(definition)
            if validation_errors:
                raise WorkflowValidationError(
                    f"Invalid workflow definition: {'; '.join(validation_errors)}"
                )

            # Check node types exist in registry
            for node in nodes:
                ntype = node.get("type", "unknown")
                if ntype not in self._node_registry:
                    raise WorkflowValidationError(f"Unknown node type: {ntype}")

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
            visited_count = 0
            while queue:
                current_batch = list(queue)
                queue = []
                exec_order.append(current_batch)
                visited_count += len(current_batch)
                for nid in current_batch:
                    for neighbor in adj.get(nid, []):
                        in_degree[neighbor] -= 1
                        if in_degree[neighbor] == 0:
                            queue.append(neighbor)

            # Safety check: all nodes should be visited
            if visited_count != len(nodes):
                raise WorkflowValidationError(
                    f"Topological sort incomplete — possible cycle detected "
                    f"({visited_count}/{len(nodes)} nodes reachable)"
                )

            # Execute batches
            node_outputs = {}
            if input_data:
                node_outputs["_input"] = input_data

            has_failed_node = False
            for batch in exec_order:
                tasks = []
                for node_id in batch:
                    node_def = node_map[node_id]
                    is_leaf = node_id in leaf_nodes
                    tasks.append(
                        self._execute_node(run, node_id, node_def, node_outputs, persist_leads=is_leaf)
                    )
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for node_id, result in zip(batch, results):
                    if isinstance(result, Exception):
                        node_outputs[node_id] = {"error": str(result), "leads": []}
                        logger.error("Node %s failed: %s", node_id, result)
                        has_failed_node = True
                    else:
                        node_outputs[node_id] = result

            # Complete run — commit everything (leads + run status) together
            run.status = "completed_with_errors" if has_failed_node else "completed"
            # Store only metadata in output_data (leads are persisted separately in scraped_leads)
            summary = {}
            for k, v in node_outputs.items():
                if k == "_input":
                    continue
                if isinstance(v, dict):
                    entry = {key: val for key, val in v.items() if key != "leads"}
                    entry["lead_count"] = len(v.get("leads", []))
                    summary[k] = entry
                else:
                    summary[k] = v
            run.output_data = summary
            run.completed_at = datetime.utcnow()
            await self.db.commit()

        except WorkflowValidationError as e:
            run.status = "failed"
            run.error_message = str(e)
            run.completed_at = datetime.utcnow()
            try:
                await self.db.rollback()
            except Exception:
                pass
            # Re-attach run to session and commit status
            self.db.add(run)
            await self.db.commit()
            logger.error("Workflow validation failed for run %s: %s", run.id, e)

        except Exception as e:
            run.status = "failed"
            error_msg = str(e)[:1000]
            run.error_message = error_msg + "..." if len(str(e)) > 1000 else error_msg
            run.completed_at = datetime.utcnow()
            try:
                await self.db.rollback()
            except Exception:
                pass
            self.db.add(run)
            await self.db.commit()
            logger.exception("Workflow run %s failed", run.id)

    async def _execute_node(
        self,
        run: WorkflowRun,
        node_id: str,
        node_def: dict,
        node_outputs: dict,
        persist_leads: bool = False,
    ):
        """Execute a single node with timeout. Only persist leads to DB if persist_leads=True (leaf nodes)."""
        node_type = node_def.get("type", "unknown")
        node_config = node_def.get("data", {}).get("config", {})

        # Create node run record (lock to serialize DB ops during parallel execution)
        node_run = WorkflowNodeRun(
            run_id=run.id,
            node_id=node_id,
            node_type=node_type,
            status="running",
            started_at=datetime.utcnow(),
        )
        async with self._db_lock:
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
                        # Skip upstream errors — don't feed error outputs downstream
                        if isinstance(src_output, dict) and "error" in src_output and len(src_output.get("leads", [])) == 0:
                            continue
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

            # Store input summary without full lead arrays to keep DB manageable
            input_summary = {}
            for k, v in input_data.items():
                if isinstance(v, dict) and "leads" in v:
                    entry = {key: val for key, val in v.items() if key != "leads"}
                    entry["lead_count"] = len(v.get("leads", []))
                    input_summary[k] = entry
                else:
                    input_summary[k] = v
            node_run.input_data = input_summary

            # Get node executor
            executor_cls = self._node_registry.get(node_type)
            if not executor_cls:
                raise ValueError(f"Unknown node type: {node_type}")

            executor = executor_cls(config=node_config, db=self.db, run=run)

            # Execute with timeout
            result = await asyncio.wait_for(
                executor.execute(input_data),
                timeout=settings.NODE_TIMEOUT_SECONDS,
            )

            # Cap leads to prevent memory issues
            if isinstance(result, dict) and "leads" in result:
                leads = result["leads"]
                if isinstance(leads, list) and len(leads) > settings.MAX_LEADS_PER_NODE:
                    logger.warning(
                        "Node %s produced %d leads, capping to %d",
                        node_id, len(leads), settings.MAX_LEADS_PER_NODE,
                    )
                    result["leads"] = leads[: settings.MAX_LEADS_PER_NODE]
                    result["count"] = len(result["leads"])
                    result["truncated"] = True

            # Only persist leads for leaf nodes to avoid duplicates
            if persist_leads:
                leads = result.get("leads", []) if isinstance(result, dict) else []
                if leads:
                    logger.info("Persisting %d leads from node %s", len(leads), node_id)
                    persisted = 0
                    async with self._db_lock:
                        for i, lead_data in enumerate(leads):
                            if not isinstance(lead_data, dict):
                                continue
                            lead = ScrapedLead(
                                workflow_run_id=run.id,
                                name=lead_data.get("name") or "Unknown",
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
                            persisted += 1
                            if persisted % LEAD_BATCH_SIZE == 0:
                                await self.db.flush()
                        if persisted % LEAD_BATCH_SIZE != 0:
                            await self.db.flush()
                    logger.info("Persisted %d leads from node %s", persisted, node_id)

            node_run.status = "completed"
            # Store summary without full lead arrays to keep DB manageable
            if isinstance(result, dict) and "leads" in result:
                node_output = {k: v for k, v in result.items() if k != "leads"}
                node_output["lead_count"] = len(result.get("leads", []))
                node_run.output_data = node_output
            else:
                node_run.output_data = result
            node_run.completed_at = datetime.utcnow()
            node_run.execution_time_ms = int(
                (node_run.completed_at - node_run.started_at).total_seconds() * 1000
            )
            async with self._db_lock:
                await self.db.flush()
            return result

        except asyncio.TimeoutError:
            node_run.status = "failed"
            node_run.error_message = f"Node timed out after {settings.NODE_TIMEOUT_SECONDS}s"
            node_run.completed_at = datetime.utcnow()
            async with self._db_lock:
                await self.db.flush()
            raise TimeoutError(node_run.error_message)

        except Exception as e:
            node_run.status = "failed"
            error_msg = str(e)[:1000]
            node_run.error_message = error_msg + "..." if len(str(e)) > 1000 else error_msg
            node_run.completed_at = datetime.utcnow()
            async with self._db_lock:
                await self.db.flush()
            raise
