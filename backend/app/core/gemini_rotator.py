import os
from google import genai
from typing import Dict, List

class GeminiRotator:
    def __init__(self):
        self.keys_lawyer1 = [
            os.getenv("GEMINI_KEY_1"),
            os.getenv("GEMINI_KEY_2"),
        ]
        self.keys_lawyer2 = [
            os.getenv("GEMINI_KEY_3"),
            os.getenv("GEMINI_KEY_4"),
        ]
        
        # Track usage: {key: count}
        self.usage = {k: 0 for k in self.keys_lawyer1 + self.keys_lawyer2 if k}
        
        # Active indices
        self.idx1 = 0
        self.idx2 = 0

    def get_client(self, lawyer_id: int):
        """
        Returns a Gemini client for the given lawyer (1 or 2).
        Each key is used up to 5 times.
        """
        keys = self.keys_lawyer1 if lawyer_id == 1 else self.keys_lawyer2
        idx = self.idx1 if lawyer_id == 1 else self.idx2
        
        current_key = keys[idx]
        
        # If current key reached 5 fetches, move to the next one
        if self.usage.get(current_key, 0) >= 5:
            idx = (idx + 1) % len(keys)
            if lawyer_id == 1:
                self.idx1 = idx
            else:
                self.idx2 = idx
            current_key = keys[idx]
            
        # Update usage
        if current_key:
            self.usage[current_key] = self.usage.get(current_key, 0) + 1
            return genai.Client(api_key=current_key)
        
        # Fallback to general key if everything fails
        return genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

gemini_rotator = GeminiRotator()
