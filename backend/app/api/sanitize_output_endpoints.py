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
