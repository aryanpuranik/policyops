from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.core.database import Base


class PolicyDocument(Base):
    __tablename__ = "policy_documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, default=0)
    content_text = Column(Text, nullable=True)
    status = Column(String, default="uploaded")  # uploaded | processing | completed | failed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
