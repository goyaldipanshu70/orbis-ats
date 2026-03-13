"""LangGraph workflow for interview question generation."""
from langgraph.graph import StateGraph, END
from app.schemas.interview_state import InterviewQuestionsState
from app.nodes.interview.question_generator import generate_questions

def build_interview_questions_graph():
    graph = StateGraph(InterviewQuestionsState)
    graph.add_node("generate_questions", generate_questions)
    graph.set_entry_point("generate_questions")
    graph.add_edge("generate_questions", END)
    return graph.compile()

interview_questions_graph = build_interview_questions_graph()
