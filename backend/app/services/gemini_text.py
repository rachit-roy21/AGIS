# # from fastapi import APIRouter, Depends, HTTPException
# # from sqlalchemy.orm import Session
# # from app.core.database import get_db
# # from app.services.session_manager import SessionManager
# # from app.services.gemini_pdf_sanitizer import sanitize_text

# # router = APIRouter(prefix="/api/sanitize", tags=["sanitize"])

# # @router.post("/text")
# # async def sanitize_text_api(request: dict, db: Session = Depends(get_db)):

# #     session_id = request.get("session_id")
# #     text = request.get("text")

# #     manager = SessionManager(db)

# #     if not manager.validate_session(session_id):
# #         raise HTTPException(status_code=401, detail="Invalid session")

# #     result = await sanitize_text(text, session_id)

# #     return result
# import json
# import hashlib
# from datetime import datetime

# from google import genai
# from app.core.config import settings

# # Create client
# client = genai.Client(api_key=settings.GEMINI_API_KEY)

# MODEL_NAME = "models/gemini-2.0-flash-lite"


# async def sanitize_text(text: str):

#     prompt = prompt = f"""
# Extract sensitive personal data from the text.

# Return ONLY valid JSON.
# No explanation.
# No markdown.
# No text before or after.

# Format:
# [
#   {{"text": "entity_value", "type": "PHONE|EMAIL|NAME|ADDRESS", "confidence": 0.0-1.0}}
# ]

# Text:
# {text}
# """

#     print(f"[Gemini] Using model: {MODEL_NAME}")
#     try:
#         response = client.models.generate_content(
#             model=MODEL_NAME,
#             contents=prompt
#         )
#         print(f"[Gemini] Success, response: {response.text[:50]}...")
#     except Exception as e:
#         print(f"[Gemini] FAILED: {str(e)}")
#         if hasattr(e, 'response'):
#              print(f"[Gemini] Error Response: {e.response}")
#         raise e

#     try:
#         raw = response.text
#         entities = json.loads(raw)
#     except Exception:
#         print(f"[Gemini] JSON Parse failed: {response.text}")
#         entities = []

#     token_map = {}
#     sanitized = text

#     for e in entities:
#         token = "TOKEN_" + hashlib.sha256(
#             f"{e['text']}{datetime.utcnow()}".encode()
#         ).hexdigest()[:6]

#         token_map[token] = e["text"]
#         sanitized = sanitized.replace(e["text"], f"[{token}]")

#     return {
#         "sanitized_text": sanitized,
#         "tokens": token_map,
#         "engine": "gemini"
#     }


import json
import hashlib
import re
from datetime import datetime

from google import genai
from app.core.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

MODEL_NAME = "models/gemini-2.0-flash-lite"


async def sanitize_text(text: str):

    prompt = f"""
Extract sensitive personal data from the text.

Return ONLY valid JSON.
No explanation.
No markdown.
No text before or after.

Format:
[
  {{"text": "entity_value", "type": "PHONE|EMAIL|NAME|ADDRESS", "confidence": 0.0-1.0}}
]

Text:
{text}
"""

    print(f"[Gemini] Using model: {MODEL_NAME}")

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )

        raw = response.text
        entities = json.loads(raw)

        print(f"[Gemini] Success")

    except Exception as e:
        print(f"[Gemini] FAILED → fallback: {str(e)}")

        entities = []

        emails = re.findall(r'\S+@\S+', text)
        for email in emails:
            entities.append({
                "text": email,
                "type": "EMAIL",
                "confidence": 0.9
            })

        phones = re.findall(r'\b\d{10}\b', text)
        for phone in phones:
            entities.append({
                "text": phone,
                "type": "PHONE",
                "confidence": 0.9
            })

        words = text.split()
        for word in words:
            if word.istitle() and len(word) > 2:
                entities.append({
                    "text": word,
                    "type": "NAME",
                    "confidence": 0.6
                })

    token_map = {}
    sanitized = text

    for e in entities:
        token = "TOKEN_" + hashlib.sha256(
            f"{e['text']}{datetime.utcnow()}".encode()
        ).hexdigest()[:6]

        token_map[token] = e["text"]
        sanitized = sanitized.replace(e["text"], f"[{token}]")

    return {
        "sanitized_text": sanitized,
        "tokens": token_map,
        "engine": "hybrid"
    }