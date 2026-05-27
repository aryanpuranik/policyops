from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text

from app.core.database import Base


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    policy_id = Column(String, ForeignKey("policy_documents.id"), nullable=False)
    status = Column(String, default="pending")  # pending | running | completed | failed | awaiting_review
    current_agent = Column(String, nullable=True)
    progress = Column(Integer, default=0)
    graph_state = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(String, ForeignKey("agent_runs.id"), nullable=False)
    agent_name = Column(String, nullable=False)
    status = Column(String, default="running")  # running | completed | failed | skipped
    message = Column(Text, nullable=True)
    output_data = Column(JSON, nullable=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
