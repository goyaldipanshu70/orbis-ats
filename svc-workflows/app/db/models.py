from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float, Boolean
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import enum

Base = declarative_base()


class WorkflowStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    archived = "archived"


class RunStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class NodeRunStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    skipped = "skipped"


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    definition_json = Column(JSON, nullable=False, default=dict)
    status = Column(String(20), nullable=False, default="draft")
    trigger_type = Column(String(50))
    trigger_config = Column(JSON)
    created_by = Column(String(50), nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    runs = relationship("WorkflowRun", back_populates="workflow", lazy="dynamic")


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    trigger_type = Column(String(50))
    input_data = Column(JSON)
    output_data = Column(JSON)
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(50))

    workflow = relationship("Workflow", back_populates="runs")
    node_runs = relationship("WorkflowNodeRun", back_populates="run", lazy="dynamic")


class WorkflowNodeRun(Base):
    __tablename__ = "workflow_node_runs"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(String(100), nullable=False)
    node_type = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    input_data = Column(JSON)
    output_data = Column(JSON)
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    execution_time_ms = Column(Integer)

    run = relationship("WorkflowRun", back_populates="node_runs")


class ScrapedLead(Base):
    __tablename__ = "scraped_leads"

    id = Column(Integer, primary_key=True, index=True)
    workflow_run_id = Column(Integer, ForeignKey("workflow_runs.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(200))
    email = Column(String(255))
    linkedin_url = Column(Text)
    github_url = Column(Text)
    portfolio_url = Column(Text)
    headline = Column(Text)
    location = Column(String(200))
    skills = Column(JSON)
    experience_years = Column(Float)
    source = Column(String(100))
    source_url = Column(Text)
    score = Column(Float)
    score_breakdown = Column(JSON)
    raw_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
