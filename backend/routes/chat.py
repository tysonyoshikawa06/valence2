from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import os
from openai import OpenAI

router = APIRouter()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    node_id: str

@router.post("/chat")
async def chat(request: ChatRequest):
    try:
        # Convert messages to OpenAI format
        openai_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]
        
        # System message containing node content
        system_message = {
            "role": "system",
            "content": f"You are an AI tutor named Val. Your job is to help the user with {request.node_id} ONLY. Keep responses concise and relevant."
        }
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[system_message] + openai_messages,
            max_tokens=500,
            temperature=0.7
        )
        
        # Extract the Val's reply
        val_message = response.choices[0].message.content
        
        return {
            "message": val_message
        }
        
    except Exception as e:
        print(f"OpenAI API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))