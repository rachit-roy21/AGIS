from fastapi import APIRouter, UploadFile, File, Request, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import uuid

from app.services.gemini_text import sanitize_text
from app.services.gemini_pdf_sanitizer import sanitize_pdf_file
from app.services.session_tracker import SessionTracker
from app.services.sanitized_output_service import SanitizedOutputService
from app.core.redis import redis_client
from app.core.database import get_db

router = APIRouter(prefix="/api/sanitize", tags=["sanitize"])

@router.post("/pdf")
async def sanitize_pdf_api(
    request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    session_id = request.headers.get("session-id") or request.headers.get(
        "X-Session-ID"
    )
    processing_id = request.headers.get("processing-id") or request.headers.get(
        "X-Processing-ID"
    )

    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID missing")

    if not processing_id:
        raise HTTPException(status_code=400, detail="Processing ID missing")

    ip_address = request.client.host if request.client else "unknown"

    # Initialize services
    session_tracker = SessionTracker(redis_client)
    output_service = SanitizedOutputService(db)

    # Set pipeline status to running
    await session_tracker.set_pipeline_status(session_id, "running")

    try:
        result = await sanitize_pdf_file(file, session_id, ip_address)

        if isinstance(result, dict) and result.get("status") == "error":
            await session_tracker.set_pipeline_status(session_id, "error")
            return result

        # Store tokenized content in database
        await output_service.store_pdf_output(
            session_id=session_id,
            processing_id=processing_id,
            masked_text=result["masked_text"],
        )

        # Set pipeline status back to idle after successful processing
        await session_tracker.set_pipeline_status(session_id, "idle")

        # Prepare token IDs for header (comma-separated list)
        token_ids = ",".join(result["tokens"].keys())

        import base64
        return {
            "status": "success",
            "pdf_base64": base64.b64encode(result["pdf_bytes"]).decode("utf-8"),
            "original_text": result["original_text"],
            "masked_text": result["masked_text"],
            "tokens": result["tokens"],
            "pages": result["pages"],
            "processing_time": result["processing_time_sec"],
            "gemini_calls": result["gemini_calls"],
            "processing_id": processing_id,
        }

    except Exception as e:
        # Set pipeline status to error on exception
        print(f"[Sanitize] PDF Error: {str(e)}")
        await session_tracker.set_pipeline_status(session_id, "error")
        raise e


@router.get("/ping")
async def ping():
    return {"sanitize": "alive"}


@router.post("/text")
async def sanitize_text_api(request: Request, req: dict, db: Session = Depends(get_db)):
    """
    Sanitize raw text using Gemini
    """
    session_id = request.headers.get("session-id") or request.headers.get(
        "X-Session-ID"
    )
    processing_id = request.headers.get("processing-id") or request.headers.get(
        "X-Processing-ID"
    )

    print(f"[Sanitize] Request Headers: Session={session_id}, Processing={processing_id}")

    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID missing")

    if not processing_id:
        raise HTTPException(status_code=400, detail="Processing ID missing")

    # Initialize services
    session_tracker = SessionTracker(redis_client)
    output_service = SanitizedOutputService(db)

    # Set pipeline status to running
    await session_tracker.set_pipeline_status(session_id, "running")

    try:
        result = await sanitize_text(req["text"])

        # Store tokenized content in database
        await output_service.store_text_output(
            session_id=session_id,
            processing_id=processing_id,
            sanitized_text=result["sanitized_text"],
        )

        # Set pipeline status back to idle after successful processing
        await session_tracker.set_pipeline_status(session_id, "idle")

        return result

    except Exception as e:
        # Set pipeline status to error on exception
        await session_tracker.set_pipeline_status(session_id, "error")
        raise e


@router.get("/outputs/{processing_id}")
async def get_processing_outputs(processing_id: str, db: Session = Depends(get_db)):
    """
    Get all sanitized outputs for a specific processing ID
    Used by future LLM for context building
    """
    output_service = SanitizedOutputService(db)
    outputs = output_service.get_outputs_by_processing_id(processing_id)

    if not outputs:
        raise HTTPException(
            status_code=404, detail="No outputs found for processing ID"
        )

    return {
        "processing_id": processing_id,
        "outputs": [
            {
                "session_id": output.session_id,
                "input_type": output.input_type,
                "tokenized_content": output.tokenized_content,
                "engine": output.engine,
                "created_at": output.created_at.isoformat(),
            }
            for output in outputs
        ],
    }


@router.get("/outputs/session/{session_id}")
async def get_session_outputs(session_id: str, db: Session = Depends(get_db)):
    """
    Get all sanitized outputs for a session
    """
    output_service = SanitizedOutputService(db)
    outputs = output_service.get_outputs_by_session(session_id)

    if not outputs:
        raise HTTPException(status_code=404, detail="No outputs found for session")

    return {
        "session_id": session_id,
        "outputs": [
            {
                "processing_id": output.processing_id,
                "input_type": output.input_type,
                "tokenized_content": output.tokenized_content,
                "engine": output.engine,
                "created_at": output.created_at.isoformat(),
            }
            for output in outputs
        ],
    }
