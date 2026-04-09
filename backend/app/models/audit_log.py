from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from datetime import datetime
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey('sessions.id'))
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    event_type = Column(String(50), nullable=False)
    event_metadata = Column(JSONB)
    ip_address = Column(INET)