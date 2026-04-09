from pydantic import BaseModel
from typing import Dict, Optional, List
import uuid

class SessionCreateResponse(BaseModel):
    session_id: str
    challenge: str
    expires_in: int

class SanitizeRequest(BaseModel):
    pdf_base64: str
    session_id: str

class SanitizeResponse(BaseModel):
    sanitized_pdf: str
    encrypted_token_map: Dict
    pages_processed: int
    entities_detected: int
    processing_time_ms: int

class QueryRequest(BaseModel):
    tokenized_query: str
    session_id: str
    context: Optional[str] = ""

class QueryResponse(BaseModel):
    tokenized_response: str
    tokens_in_response: List[str]
    processing_time_ms: int