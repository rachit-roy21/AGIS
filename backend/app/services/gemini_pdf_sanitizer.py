import pymupdf
import time
import uuid

from app.services.gemini_text import sanitize_text
from app.models.audit_log import AuditLog
from app.core.database import SessionLocal

MAX_PAGES = 10
BATCH_SIZE = 2  # pages per Gemini call

async def sanitize_pdf_file(file, session_id=None, ip_address=None):
    start_time = time.time()
    db = SessionLocal()

    # Convert session_id to UUID if string
    if isinstance(session_id, str):
        try:
            session_id = uuid.UUID(session_id)
        except Exception:
            pass
    db.add(
        AuditLog(
            session_id=session_id,
            event_type="UPLOAD_RECEIVED",
            event_metadata={"filename": file.filename},
            ip_address=ip_address,
        )
    )
    db.commit()

    # Read PDF
    try:
        pdf_bytes = await file.read()
        print(f"[PDF] Read {len(pdf_bytes)} bytes")
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        print(f"[PDF] Opened document: {doc.page_count} pages")
    except Exception as e:
        print(f"[PDF] Failed to open document: {e}")
        db.close()
        return {"status": "error", "message": f"Invalid PDF: {str(e)}"}

    # Limit pages
    if doc.page_count > MAX_PAGES:
        print(f"[PDF] Limiting to {MAX_PAGES} pages")
        doc = doc.copy() # Avoid slice if it causes issues in some versions
        if doc.page_count > MAX_PAGES:
            doc.delete_pages(range(MAX_PAGES, doc.page_count))

    total_pages = doc.page_count
    all_tokens = {}
    gemini_calls = 0

    # --- text extraction + entity detection ---
    full_original_text = ""
    full_masked_text = ""
    
    # Process with Gemini
    # Instead of batching for text extraction only, we use the results of sanitize_text
    total_pages = doc.page_count
    all_tokens = {}
    gemini_calls = 0

    for start in range(0, total_pages, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total_pages)
        page_range = list(range(start, end))

        batch_original_text = ""
        for page_num in page_range:
            page_content = doc[page_num].get_text()
            batch_original_text += f"\n--- PAGE {page_num + 1} ---\n{page_content}"
        
        full_original_text += batch_original_text

        # 🔹 EVENT 2 — Gemini batch processing
        db.add(
            AuditLog(
                session_id=session_id,
                event_type="BATCH_PROCESSING",
                event_metadata={
                    "pages": page_range,
                    "batch": (start // BATCH_SIZE) + 1,
                },
                ip_address=ip_address,
            )
        )
        db.commit()

        # Sanitize batch
        result = await sanitize_text(batch_original_text)
        batch_tokens = result["tokens"]
        batch_masked_text = result["sanitized_text"]
        
        all_tokens.update(batch_tokens)
        full_masked_text += batch_masked_text
        gemini_calls += 1

    # 🔹 EVENT 3 — Token mapping ready
    db.add(
        AuditLog(
            session_id=session_id,
            event_type="TOKEN_MAPPING_COMPLETE",
            event_metadata={
                "tokens_detected": len(all_tokens),
                "batches": gemini_calls,
            },
            ip_address=ip_address,
        )
    )
    db.commit()

    # --- physical redaction ---
    for page in doc:
        words_on_page = page.get_text("words")

        for token, original in all_tokens.items():
            for w in words_on_page:
                if original in w[4]:
                    rect = pymupdf.Rect(w[:4])
                    page.add_redact_annot(rect, fill=(0, 0, 0))

        page.apply_redactions()

    redacted_pdf_bytes = doc.write()

    processing_time = round(time.time() - start_time, 2)

    # 🔹 EVENT 4 — Redaction complete
    db.add(
        AuditLog(
            session_id=session_id,
            event_type="REDACTION_COMPLETE",
            event_metadata={"pages": total_pages, "processing_time": processing_time},
            ip_address=ip_address,
        )
    )
    db.commit()
    db.close()

    return {
        "pdf_bytes": redacted_pdf_bytes,
        "tokens": all_tokens,
        "pages": total_pages,
        "processing_time_sec": processing_time,
        "gemini_calls": gemini_calls,
        "original_text": full_original_text,
        "masked_text": full_masked_text,
    }
