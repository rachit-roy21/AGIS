from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.core.database import Base


class SanitizedOutput(Base):
    __tablename__ = "sanitized_outputs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    processing_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    input_type = Column(String(10), nullable=False)  # "text" or "pdf"
    tokenized_content = Column(Text, nullable=False)
    engine = Column(String(50), nullable=False, default="gemini")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Index for efficient querying
    __table_args__ = (
        {"schema": None},  # Use default schema
    )