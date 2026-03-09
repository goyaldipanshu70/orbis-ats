from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime


class Base(DeclarativeBase):
    pass


class ExecutionLog(Base):
    __tablename__ = "execution_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_type = Column(String(30), nullable=False, index=True)
    execution_id = Column(String(50), nullable=False, unique=True, index=True)
    user_id = Column(String(50), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="running")
    provider = Column(String(20), nullable=True)
    model = Column(String(50), nullable=True)
    input_summary = Column(Text, nullable=True)
    output_summary = Column(Text, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    total_duration_ms = Column(Integer, nullable=True)
    node_count = Column(Integer, nullable=False, default=0)
    iteration_count = Column(Integer, nullable=False, default=0)
    error = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class NodeExecution(Base):
    __tablename__ = "node_executions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    execution_id = Column(String(50), ForeignKey("execution_logs.execution_id"), nullable=False, index=True)
    node_name = Column(String(50), nullable=False)
    node_type = Column(String(30), nullable=True)
    status = Column(String(20), nullable=False)
    input_data = Column(JSONB, nullable=True)
    output_data = Column(JSONB, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    tokens_used = Column(Integer, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class AgentConversationMemory(Base):
    __tablename__ = "agent_conversation_memory"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), nullable=False, index=True)
    conversation_id = Column(String(50), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    tool_calls = Column(JSONB, nullable=True)
    tool_call_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
