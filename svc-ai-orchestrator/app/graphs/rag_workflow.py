"""LangGraph state machine for RAG Pipeline.

Flow:
  START → embed_query → vector_search → rerank → generate_answer → END
"""
import logging

from langgraph.graph import StateGraph, END

from app.schemas.rag_state import RAGState
from app.nodes.rag.embedder import embed_query_node
from app.nodes.rag.retriever import vector_search_node
from app.nodes.rag.reranker import rerank_node
from app.nodes.rag.generator import generate_answer_node

logger = logging.getLogger(__name__)


def build_rag_workflow_graph() -> StateGraph:
    graph = StateGraph(RAGState)

    graph.add_node("embed_query", embed_query_node)
    graph.add_node("vector_search", vector_search_node)
    graph.add_node("rerank", rerank_node)
    graph.add_node("generate_answer", generate_answer_node)

    graph.set_entry_point("embed_query")

    graph.add_edge("embed_query", "vector_search")
    graph.add_edge("vector_search", "rerank")
    graph.add_edge("rerank", "generate_answer")
    graph.add_edge("generate_answer", END)

    return graph.compile()


rag_workflow_graph = build_rag_workflow_graph()
