from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Text

from app.core.database import Base


class HumanReview(Base):
    __tablename__ = "human_reviews"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False)
    run_id = Column(String, ForeignKey("agent_runs.id"), nullable=False)
    review_type = Column(String, nullable=False)   # conflict | risk | workflow | exception
    question = Column(Text, nullable=False)
    context_data = Column(JSON, nullable=True)
    status = Column(String, default="pending")     # pending | approved | rejected | modified
    reviewer_decision = Column(String, nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    modified_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime, nullable=True)
