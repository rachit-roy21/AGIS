from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.debate_service import DebateService

router = APIRouter(prefix="/api/debate", tags=["debate"])

@router.post("/run/{session_id}")
async def run_session_debate(session_id: str, db: Session = Depends(get_db)):
    """
    Run an AI Security Debate based on the sanitized content of a session.
    """
    debate_service = DebateService(db)
    try:
        result = await debate_service.run_debate(session_id)
        return {
            "session_id": session_id, 
            "transcript": result["transcript"],
            "masked_content": result["masked_content"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/session/{session_id}")
async def get_session_debates(session_id: str, db: Session = Depends(get_db)):
    """
    Get all historical debates for a session.
    """
    debate_service = DebateService(db)
    try:
        debates = debate_service.get_debates_by_session(session_id)
        return {"session_id": session_id, "debates": debates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
