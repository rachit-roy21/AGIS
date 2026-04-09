# import modal
# import pymupdf  # PyMuPDF
# import ollama
# import json
# import base64
# import io
# from PIL import Image
# from typing import List, Dict, Tuple
# import re
# from google import genai
# import os
# from dotenv import load_dotenv
# # Load env variables
# load_dotenv()

# # Read API key (keeping your variable name unchanged)
# GEMINI_API_KEYL = os.getenv("GEMINI_API_KEYL")

# # Create Gemini client (new syntax)
# gemini_client = genai.Client(api_key=GEMINI_API_KEYL)
# # Define Modal stub
# # TEMP: Disable Modal infra while testing Gemini locally
# if False:
#     app = modal.App("vaultsim-privacy-shield")

#     image = modal.Image.from_dockerfile(
#         "Dockerfile",
#         context_mount=modal.mount.from_local_dir(".", remote_path="/app")
#     )

# print("Key loaded:", GEMINI_API_KEYL[:6])

# # Define the sanitizer function
# # @app.function(
# #     image=image,
# #     gpu="T4",  # GPU acceleration for Gemma
# #     timeout=60,  # 60 second max
# #     memory=8192,  # 8GB RAM
# #     secret=modal.Secret.from_name("vaultsim-secrets")  # API keys
# # )
# def sanitize_document(pdf_base64: str, session_id: str) -> Dict:
#     """
#     Zero-API sanitization using local Gemma 3 1B
    
#     Process:
#     1. Decode PDF
#     2. Extract text from each page (OCR)
#     3. Detect PII using Gemma (100% local)
#     4. Generate tokens
#     5. Physical redaction (black boxes)
#     6. Return sanitized PDF + token map
#     """
    
#     # Decode PDF
#     pdf_bytes = base64.b64decode(pdf_base64)
#     doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    
#     all_token_maps = []
#     sanitized_pages = []
    
#     # Process each page
#     for page_num in range(len(doc)):
#         page = doc[page_num]
        
#         # Extract text
#         text = page.get_text()
        
#         # Detect PII using local Gemma
#         entities = detect_pii_with_gemma(text)
        
#         # Generate tokens
#         token_map = generate_tokens(entities)
#         all_token_maps.append(token_map)
        
#         # Physical redaction
#         sanitized_page = apply_physical_redaction(page, entities, token_map)
#         sanitized_pages.append(sanitized_page)
    
#     # Merge all token maps
#     merged_token_map = {}
#     for tm in all_token_maps:
#         merged_token_map.update(tm)
    
#     # Save sanitized PDF
#     output = io.BytesIO()
#     sanitized_doc = create_sanitized_pdf(sanitized_pages)
#     sanitized_doc.save(output)
#     sanitized_pdf_base64 = base64.b64encode(output.getvalue()).decode()
    
#     # Encrypt token map (using session-specific key derivation)
#     encrypted_token_map = encrypt_token_map(merged_token_map, session_id)
    
#     return {
#         "sanitized_pdf": sanitized_pdf_base64,
#         "encrypted_token_map": encrypted_token_map,
#         "pages_processed": len(doc),
#         "entities_detected": len(merged_token_map)
#     }

# def detect_pii_with_gemma(text: str) -> List[Dict]:
#     """
#     Use Gemini Flash API to detect PII entities
#     (Temporary replacement for Ollama — rest of pipeline unchanged)
#     """

#     prompt = f"""You are a PII detection system. Analyze this text and extract all personally identifiable information.

# Return ONLY a JSON array with this exact structure:
# [
#   {{"text": "detected entity", "type": "PERSON|ORG|MONEY|DATE|LOCATION|EMAIL|PHONE", "confidence": 0.0-1.0, "start": 0, "end": 10}}
# ]

# Rules:
# - Only return entities with confidence > 0.7
# - Include start/end character positions
# - Be precise
# - Output must be valid JSON only

# Text to analyze:
# {text}

# JSON output:"""

#     try:
#         # Gemini Flash call (new SDK syntax)
#         response = gemini_client.models.generate_content(
#             model="gemini-1.5-flash",
#             contents=prompt
#         )

#         response_text = response.text.strip()

#         # Extract JSON if wrapped in code blocks
#         if "```json" in response_text:
#             json_text = response_text.split("```json")[1].split("```")[0].strip()
#         elif "```" in response_text:
#             json_text = response_text.split("```")[1].split("```")[0].strip()
#         else:
#             json_text = response_text

#         entities = json.loads(json_text)

#         # Filter by confidence
#         return [e for e in entities if e.get("confidence", 0) > 0.7]

#     except Exception as e:
#         print(f"Gemini parsing failed: {e}")
#         return fallback_regex_detection(text)




# def fallback_regex_detection(text: str) -> List[Dict]:
#     """
#     Fallback PII detection using regex patterns
#     Used if Gemma parsing fails
#     """
#     patterns = {
#         'EMAIL': r'[\w.-]+@[\w.-]+\.\w+',
#         'PHONE': r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
#         'SSN': r'\d{3}-\d{2}-\d{4}',
#         'MONEY': r'\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?',
#         'PERSON': r'\b[A-Z][a-z]+ [A-Z][a-z]+\b'
#     }
    
#     entities = []
#     for entity_type, pattern in patterns.items():
#         for match in re.finditer(pattern, text):
#             entities.append({
#                 'text': match.group(),
#                 'type': entity_type,
#                 'confidence': 0.75,
#                 'start': match.start(),
#                 'end': match.end()
#             })
    
#     return entities


# def generate_tokens(entities: List[Dict]) -> Dict[str, str]:
#     """
#     Generate deterministic tokens for entities
#     Format: TOKEN_<TYPE>_<SHORT_HASH>
#     """
#     import hashlib
#     from datetime import datetime
    
#     token_map = {}
    
#     for entity in entities:
#         # Create deterministic but unique token
#         entity_text = entity['text']
#         entity_type = entity['type']
        
#         # Hash the entity text for uniqueness
#         hash_input = f"{entity_text}_{entity_type}_{datetime.utcnow().timestamp()}"
#         short_hash = hashlib.sha256(hash_input.encode()).hexdigest()[:8]
        
#         token = f"TOKEN_{entity_type}_{short_hash}"
#         token_map[token] = entity_text
    
#     return token_map


# def apply_physical_redaction(
#     page: pymupdf.Page,
#     entities: List[Dict],
#     token_map: Dict[str, str]
# ) -> pymupdf.Page:
#     """
#     Draw black rectangles over PII and overlay tokens
#     """
    
#     for entity in entities:
#         # Find bounding boxes for this text
#         text_instances = page.search_for(entity['text'])
        
#         for rect in text_instances:
#             # Draw black rectangle
#             page.draw_rect(rect, color=(0, 0, 0), fill=(0, 0, 0))
            
#             # Find corresponding token
#             token = [k for k, v in token_map.items() if v == entity['text']][0]
            
#             # Overlay token text in white
#             page.insert_text(
#                 (rect.x0 + 2, rect.y0 + 10),
#                 f"[{token}]",
#                 fontsize=8,
#                 color=(1, 1, 1)  # White
#             )
    
#     return page


# def create_sanitized_pdf(pages: List[pymupdf.Page]) -> pymupdf.Document:
#     """
#     Create new PDF from sanitized pages
#     """
#     new_doc = pymupdf.open()
#     for page in pages:
#         new_doc.insert_pdf(page.parent, from_page=page.number, to_page=page.number)
#     return new_doc


# def encrypt_token_map(token_map: Dict[str, str], session_id: str) -> Dict:
#     """
#     Encrypt token map for secure transmission
#     Uses session_id as key derivation input
#     """
#     from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
#     from cryptography.hazmat.primitives import hashes
#     from cryptography.hazmat.primitives.ciphers.aead import AESGCM
#     import os
    
#     # Derive key from session_id
#     kdf = PBKDF2HMAC(
#         algorithm=hashes.SHA256(),
#         length=32,
#         salt=session_id.encode(),
#         iterations=100000,
#     )
#     key = kdf.derive(session_id.encode())
    
#     # Encrypt
#     aesgcm = AESGCM(key)
#     nonce = os.urandom(12)
    
#     token_map_json = json.dumps(token_map).encode()
#     ciphertext = aesgcm.encrypt(nonce, token_map_json, None)
    
#     return {
#         'ciphertext': base64.b64encode(ciphertext).decode(),
#         'nonce': base64.b64encode(nonce).decode()
#     }


# # Local endpoint for testing
# # @app.local_entrypoint
# # def test_sanitizer():
# #     """Test the sanitizer locally"""
# #     import sys
    
# #     if len(sys.argv) < 2:
# #         print("Usage: modal run sanitizer.py <pdf_path>")
# #         return
    
# #     pdf_path = sys.argv[1]
    
# #     with open(pdf_path, 'rb') as f:
# #         pdf_bytes = f.read()
# #         pdf_base64 = base64.b64encode(pdf_bytes).decode()
    
# #     result = sanitize_document.remote(pdf_base64, "test-session-123")
    
# #     print(f"✅ Processed {result['pages_processed']} pages")
# #     print(f"✅ Detected {result['entities_detected']} entities")
    
# #     # Save sanitized PDF
# #     sanitized_pdf_bytes = base64.b64decode(result['sanitized_pdf'])
# #     with open('sanitized_output.pdf', 'wb') as f:
# #         f.write(sanitized_pdf_bytes)
    
# #     print("✅ Sanitized PDF saved to sanitized_output.pdf")