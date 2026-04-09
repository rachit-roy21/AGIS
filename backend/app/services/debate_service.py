import os
import asyncio
import json
import uuid
from google import genai
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.services.sanitized_output_service import SanitizedOutputService
from app.models.debate import Debate

# Prompts from gemini_hackathon/agents.py
AGENT1_SYSTEM = """
You are a senior defense lawyer.

You will receive a sanitized legal document where sensitive data is replaced with tokens.

Analyze the content and argue in favor of the defendant.

Do not assume missing data.
Base arguments only on the visible tokens and structure.

If convinced by the opponent, reply ONLY:
FINAL_AGREEMENT
Keep answers under 100 words.
"""

AGENT2_SYSTEM = """
You are a prosecutor.

You will receive a sanitized legal document with masked personal data.

Argue against the defendant using logical interpretation of the content.

If convinced, reply ONLY:
FINAL_AGREEMENT
Keep answers under 100 words.
"""

from app.core.gemini_rotator import gemini_rotator

class DebateService:
    def __init__(self, db: Session):
        self.db = db
        self.output_service = SanitizedOutputService(db)

    async def get_session_content(self, session_id: str) -> str:
        """
        Combines all sanitized outputs for a session into a single 'topic' string.
        """
        outputs = self.output_service.get_outputs_by_session(session_id)
        if not outputs:
            return ""
        
        # Combine tokenized content from all outputs
        combined = []
        for out in outputs:
            combined.append(f"Source: {out.input_type}\nContent: {out.tokenized_content}")
        
        return "\n\n".join(combined)

    async def run_debate(self, session_id: str) -> Dict[str, Any]:
        topic = await self.get_session_content(session_id)
        if not topic:
            return {"transcript": [{"agent": "SYSTEM", "text": "No sanitized content found for this session."}]}

        agent1_history = [AGENT1_SYSTEM, f"Topic: {topic}"]
        agent2_history = [AGENT2_SYSTEM, f"Topic: {topic}"]

        msg = topic
        iteration = 0
        MAX_ITER = 10 
        transcript = []

        while iteration < MAX_ITER:
            try:
                # -------- Agent 1 (Defense - Lawyer 1) --------
                agent1_history.append(msg)
                res1 = await self._call_gemini(agent1_history, lawyer_id=1)
                agent1_history.append(res1)
                
                transcript.append({
                    "agent": "DefenseLawyer",
                    "text": res1 or "[No response from agent]"
                })

                if res1 and "FINAL_AGREEMENT" in res1:
                    transcript.append({"agent": "SYSTEM", "text": "Debate ended: Defense reached final agreement."})
                    break

                # -------- Agent 2 (Prosecutor - Lawyer 2) --------
                agent2_history.append(res1 or "")
                res2 = await self._call_gemini(agent2_history, lawyer_id=2)
                agent2_history.append(res2 or "")

                transcript.append({
                    "agent": "ProsecutionLawyer",
                    "text": res2 or "[No response from agent]"
                })

                if res2 and "FINAL_AGREEMENT" in res2:
                    transcript.append({"agent": "SYSTEM", "text": "Debate ended: Prosecution reached final agreement."})
                    break

                msg = res2
                iteration += 1

            except Exception as e:
                transcript.append({"agent": "SYSTEM", "text": f"Error: {str(e)}"})
                break

        if iteration >= MAX_ITER:
            transcript.append({"agent": "SYSTEM", "text": f"Conversation reached maximum of {MAX_ITER} iterations."})
        
        # -------- Judge Agent (Uses rotation too) --------
        try:
            JUDGE_SYSTEM = """
            You are a supreme court judge.
            
            Review the debate transcript between the Defense and Prosecution regarding the sanitized text.
            Your goal is to decide if the sanitization (redaction) was sufficient to protect privacy while maintaining utility, or if it was too aggressive/lenient.
            
            Evaluate the arguments blindly (without seeing the original text, only the masked version and the arguments).
            
            Provide a final verdict in 2-3 sentences.
            Start with "VERDICT: ".
            """
            
            judge_history = [JUDGE_SYSTEM]
            
            debate_log = "\n".join([f"{entry['agent']}: {entry['text']}" for entry in transcript if entry['agent'] not in ['SYSTEM']])
            judge_input = f"Masked Content:\n{topic}\n\nDebate Log:\n{debate_log}\n\nPlease provide your verdict."
            
            judge_history.append(judge_input)
            # Judge uses lawyer 1's rotation pool or similar
            judge_response = await self._call_gemini(judge_history, lawyer_id=1)
            
            transcript.append({
                "agent": "Judge",
                "text": judge_response or "[Judge failed to reach a verdict]"
            })
            
        except Exception as e:
            transcript.append({"agent": "SYSTEM", "text": f"Judge Error: {str(e)}"})

        # Save to database
        try:
            db_debate = Debate(
                session_id=uuid.UUID(session_id) if isinstance(session_id, str) else session_id,
                transcript=json.dumps(transcript)
            )
            self.db.add(db_debate)
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            print(f"Failed to save debate: {e}")

        # Return transcript AND the masked content (topic) for the frontend to unmask if needed
        return {
            "transcript": transcript,
            "masked_content": topic
        }

    def get_debates_by_session(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Get all historical debates for a session.
        """
        sid = uuid.UUID(session_id) if isinstance(session_id, str) else session_id
        debates = self.db.query(Debate).filter(Debate.session_id == sid).order_by(Debate.created_at.desc()).all()
        
        return [
            {
                "id": str(d.id),
                "created_at": d.created_at.isoformat(),
                "transcript": json.loads(d.transcript)
            }
            for d in debates
        ]

    async def _call_gemini(self, history: List[str], lawyer_id: int = 1) -> str:
        prompt = "\n".join(history)
        try:
            # Get client from rotator based on lawyer_id
            client = gemini_rotator.get_client(lawyer_id)
            
            # Validate client has API key
            if not client:
                print(f"[DebateService] Failed to get Gemini client for lawyer {lawyer_id}")
                return "Based on the evidence presented, I believe we must carefully consider the legal implications of these redacted facts."
            
            response = client.models.generate_content(
                model="gemini-2.5-flash",  # Updated to gemini-2.5-flash
                contents=prompt,
            )
            
            text = response.text.strip() if response.text else ""
            
            # If we get a response that seems like a refusal or is empty, provide a fallback
            if not text:
                print(f"[DebateService] Gemini returned empty response for lawyer {lawyer_id}")
                return "Based on the evidence presented, I believe we must carefully consider the legal implications of these redacted facts."
                
            return text
        except Exception as e:
            # Detailed error logging for debugging
            print(f"[DebateService] Gemini call failed for lawyer {lawyer_id}")
            print(f"[DebateService] Error type: {type(e).__name__}")
            print(f"[DebateService] Error details: {str(e)}")
            
            # Check if it's a specific API error
            error_msg = str(e).lower()
            if "quota" in error_msg or "rate" in error_msg:
                print(f"[DebateService] Rate limit or quota exceeded for lawyer {lawyer_id}")
            elif "api key" in error_msg or "authentication" in error_msg:
                print(f"[DebateService] API key issue for lawyer {lawyer_id}")
            
            return "My apologies, I am having trouble formulating my legal argument at this moment due to a connection issue, but my position remains firm on protecting the client's interests."
