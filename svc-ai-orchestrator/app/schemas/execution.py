from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NodeExecutionResponse(BaseModel):
    id: int
    node_name: str
    node_type: Optional[str] = None
    status: str
    duration_ms: Optional[int] = None
    tokens_used: Optional[int] = None
    retry_count: int = 0
    error: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExecutionLogResponse(BaseModel):
    id: int
    workflow_type: str
    execution_id: str
    user_id: str
    status: str
    provider: Optional[str] = None
    model: Optional[str] = None
    input_summary: Optional[str] = None
    output_summary: Optional[str] = None
    total_tokens: Optional[int] = None
    total_duration_ms: Optional[int] = None
    node_count: int = 0
    iteration_count: int = 0
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExecutionDetailResponse(ExecutionLogResponse):
    nodes: list[NodeExecutionResponse] = []


class PaginatedExecutionsResponse(BaseModel):
    items: list[ExecutionLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
