from sqlalchemy import Column, String, DateTime, TIMESTAMP, Text
from sqlalchemy.dialects.postgresql import UUID, INET
from datetime import datetime
import uuid
from app.core.database import Base

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    last_active = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    challenge = Column(String(512), nullable=False)
    ip_address = Column(INET)
    user_agent = Column(Text)
    status = Column(String(20), nullable=False, default='active')
    terminated_at = Column(TIMESTAMP, nullable=True)