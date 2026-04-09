from sqlalchemy.orm import Session
from app.models.sanitized_output import SanitizedOutput
from app.core.database import SessionLocal
import uuid
import json
from typing import List


class SanitizedOutputService:
    def __init__(self, db=None):
        self.db = db or SessionLocal()
        self.should_close_db = db is None

    def store_output(
        self,
        session_id: str,
        processing_id: str, 
        input_type: str,
        tokenized_content: str,
        engine: str = "gemini",
    ):
        """
        Generic method to store any sanitized output
        """
        # Convert to UUID if strings
        if isinstance(session_id, str):
            try:
                session_id = uuid.UUID(session_id)
            except Exception:
                pass
        
        if isinstance(processing_id, str):
            try:
                processing_id = uuid.UUID(processing_id)
            except Exception:
                pass

        try:
            sanitized_record = SanitizedOutput(
                session_id=session_id,
                processing_id=processing_id,
                input_type=input_type,
                tokenized_content=tokenized_content,
                engine=engine,
            )

            self.db.add(sanitized_record)
            self.db.commit()

        except Exception as e:
            self.db.rollback()
            raise e
        finally:
            if self.should_close_db:
                self.db.close()

    async def store_text_output(
        self,
        session_id: str,
        processing_id: str,
        sanitized_text: str,
        engine: str = "gemini",
    ):
        """
        Store sanitized text output
        """
        self.store_output(
            session_id=session_id,
            processing_id=processing_id,
            input_type="text",
            tokenized_content=sanitized_text,
            engine=engine,
        )

    async def store_pdf_output(
        self,
        session_id: str,
        processing_id: str,
        masked_text: str,
        engine: str = "gemini",
    ):
        """
        Store PDF output with its masked text content
        """
        self.store_output(
            session_id=session_id,
            processing_id=processing_id,
            input_type="pdf",
            tokenized_content=masked_text,
            engine=engine,
        )

    def get_outputs_by_processing_id(self, processing_id: str) -> List[SanitizedOutput]:
        """
        Get all outputs for a specific processing ID (for LLM context building)
        """
        with self.db as session:
            outputs = (
                session.query(SanitizedOutput)
                .filter(SanitizedOutput.processing_id == processing_id)
                .order_by(SanitizedOutput.created_at)
                .all()
            )
            return outputs

    def get_outputs_by_session(self, session_id: str) -> List[SanitizedOutput]:
        """
        Get all outputs for a session
        """
        with self.db as session:
            return (
                session.query(SanitizedOutput)
                .filter(SanitizedOutput.session_id == session_id)
                .order_by(SanitizedOutput.created_at.desc())
                .all()
            )
