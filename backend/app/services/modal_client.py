# import modal
# from app.core.config import settings
# import time

# class ModalClient:
#     def __init__(self):
#         self.function = modal.Function.lookup(
#             settings.MODAL_FUNCTION_NAME,
#             environment_name="main"
#         )
    
#     async def sanitize_document(self, pdf_base64: str, session_id: str) -> dict:
#         """
#         Call Modal serverless function for sanitization
#         """
#         start_time = time.time()
        
#         result = self.function.remote(pdf_base64, session_id)
        
#         processing_time_ms = int((time.time() - start_time) * 1000)
#         result['processing_time_ms'] = processing_time_ms
        
#         return result

# modal_client = ModalClient()