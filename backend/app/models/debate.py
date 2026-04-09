from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.core.database import Base

class Debate(Base):
    __tablename__ = "debates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    transcript = Column(Text, nullable=False) # JSON encoded string
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        {"schema": None},
    )
