from datetime import datetime, timezone
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, JSON, String, Text

from app.core.database import Base


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(String, ForeignKey("agent_runs.id"), nullable=False)
    policy_id = Column(String, ForeignKey("policy_documents.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    steps = Column(JSON, nullable=True)           # List of workflow steps
    decision_tree = Column(JSON, nullable=True)   # React Flow nodes/edges
    risk_analysis = Column(JSON, nullable=True)   # Risk findings
    exceptions = Column(JSON, nullable=True)      # Edge cases
    simulation_results = Column(JSON, nullable=True)
    extracted_rules = Column(JSON, nullable=True)
    conflicts = Column(JSON, nullable=True)
    status = Column(String, default="draft")      # draft | awaiting_review | approved | published | archived | rejected
    human_review_notes = Column(Text, nullable=True)
    version = Column(String, default="v1.0")
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    published_by = Column(String, nullable=True)
    published_at = Column(DateTime, nullable=True)
    source_document = Column(String, nullable=True)
    handoff_status = Column(JSON, nullable=True)
    read_only = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ExecutionRun(Base):
    __tablename__ = "execution_runs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False)
    execution_status = Column(String, default="not_started")  # not_started | running | completed | failed
    requires_input = Column(Boolean, default=False)
    started_at = Column(DateTime, nullable=True)
    current_step_id = Column(String, nullable=True)
    input_schema = Column(JSON, nullable=True)
    input_values = Column(JSON, nullable=True)
    recipient_type = Column(String, nullable=True)
    recipient_email = Column(String, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    computed_variables = Column(JSON, nullable=True)
    decisions = Column(JSON, nullable=True)
    next_step_id = Column(String, nullable=True)
    decision_evaluated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ExecutionDecision(Base):
    __tablename__ = "execution_decisions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(String, ForeignKey("execution_runs.id"), nullable=False)
    input_data = Column(JSON, nullable=True)
    computed_variables = Column(JSON, nullable=True)
    decisions = Column(JSON, nullable=True)
    next_step_id = Column(String, nullable=True)
    evaluated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
