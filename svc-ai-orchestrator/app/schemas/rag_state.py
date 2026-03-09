from typing import TypedDict, Optional


class RAGState(TypedDict):
    execution_id: str
    query: str
    query_embedding: Optional[list[float]]
    retrieved_chunks: Optional[list[dict]]
    reranked_chunks: Optional[list[dict]]
    context_text: str
    answer: Optional[str]
    sources: Optional[list[dict]]
    history: Optional[list[dict]]
    department_ids: Optional[list[int]]
    top_k: int
    error: Optional[str]
    provider: str
