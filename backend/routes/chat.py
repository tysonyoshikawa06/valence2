from fastapi import APIRouter, HTTPException, Header, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List
import os
import anthropic
from database import execute_query, complete_and_unlock_node
import jwt
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor

router = APIRouter()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

MAX_CHAT_HISTORY = 15

# Thread pool for blocking operations
executor = ThreadPoolExecutor(max_workers=4)

def get_current_user_id(authorization: str = Header(None)):
    """Extract user ID from JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    node_id: str

def evaluate_curiosity(question: str, topic: str) -> dict:
    """
    Evaluate if a question demonstrates curiosity and connected thinking.
    Returns: {"is_curious": bool, "reason": str}
    """
    try:
        evaluation_prompt = f"""You are evaluating student questions about chemistry to determine if they demonstrate curiosity and connected thinking.

Topic: {topic}
Student Question: {question}

A question is "curious" if it:
1. Shows interdisciplinary thinking (biology, physics, everyday life)
2. Asks "why" questions
3. Questions implications or applications
4. Compares to other chemical phenomena or tries to find patterns

Respond ONLY with valid JSON in this exact format:
{{"is_curious": true/false, "reason": "brief explanation"}}

Examples of NOT curious questions:
- "What is a [X]?"
- "Can you explain [X] again?"
- "What's the formula for...?"
"""

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            system=evaluation_prompt,
            messages=[{"role": "user", "content": question}],
            max_tokens=150,
        )

        result_text = response.content[0].text.strip()
        
        # Remove markdown code blocks if present
        if result_text.startswith("```json"):
            result_text = result_text.replace("```json", "").replace("```", "").strip()
        elif result_text.startswith("```"):
            result_text = result_text.replace("```", "").strip()
        
        result = json.loads(result_text)
        return result
        
    except Exception as e:
        print(f"Error evaluating curiosity: {e}")
        return {"is_curious": False, "reason": "Evaluation failed"}

def get_chat_response(system_content: str, messages: list):
    """Get chat response from Anthropic"""
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        system=system_content,
        messages=messages,
        max_tokens=500,
    )
    return response.content[0].text

def process_curiosity_score(user_id: str, node_id: str) -> dict:
    """Update curiosity score and completion status. Returns new state."""
    try:
        check_query = "SELECT curiosity_score, is_completed FROM user_nodes WHERE user_id = %s AND node_id = %s"
        check_result = execute_query(check_query, (user_id, node_id))

        if not check_result:
            return {"curiosity_score": None, "is_completed": False}

        current_score = check_result[0]['curiosity_score']
        is_already_completed = check_result[0]['is_completed']

        if current_score >= 5 or is_already_completed:
            return {"curiosity_score": current_score, "is_completed": is_already_completed}

        update_query = """
            UPDATE user_nodes
            SET curiosity_score = curiosity_score + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND node_id = %s
            RETURNING curiosity_score
        """
        result = execute_query(update_query, (user_id, node_id))
        if not result:
            return {"curiosity_score": current_score, "is_completed": False}

        new_score = result[0]['curiosity_score']
        print(f"✓ Curiosity score updated: {new_score}")

        if new_score >= 5:
            neighbors = complete_and_unlock_node(user_id, node_id) or []
            print(f"✓ Node completed! Unlocked neighbors: {neighbors}")
            return {"curiosity_score": new_score, "is_completed": True}

        return {"curiosity_score": new_score, "is_completed": False}

    except Exception as e:
        print(f"ERROR processing curiosity score: {e}")
        import traceback
        traceback.print_exc()
        return {"curiosity_score": None, "is_completed": False}

def save_chat_history_background(user_id: str, node_id: str, chat_history: list):
    """Background task to save chat history"""
    try:
        save_query = """
            UPDATE user_nodes
            SET chat_history = %s::jsonb,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND node_id = %s
        """
        execute_query(save_query, (json.dumps(chat_history), user_id, node_id), fetch=False)
        print(f"✓ Chat history saved ({len(chat_history)} messages)")
    except Exception as e:
        print(f"Error saving chat history: {e}")

@router.get("/chat-history/{node_id}")
async def get_chat_history(node_id: str, user_id: str = Depends(get_current_user_id)):
    """Get chat history for a specific node"""
    try:
        query = "SELECT chat_history FROM user_nodes WHERE user_id = %s AND node_id = %s"
        result = execute_query(query, (user_id, node_id))
        
        if not result or not result[0]['chat_history']:
            return {"messages": []}
        
        return {"messages": result[0]['chat_history']}
        
    except Exception as e:
        print(f"Error fetching chat history: {e}")
        return {"messages": []}

@router.post("/chat")
async def chat(
    request: ChatRequest, 
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id)
):
    try:
        print(f"Chat request - User ID: {user_id}, Node ID: {request.node_id}")
        
        # Get the user's latest question
        user_messages = [msg for msg in request.messages if msg.role == "user"]
        if not user_messages:
            raise HTTPException(status_code=400, detail="No user message found")
        
        latest_question = user_messages[-1].content
        print(f"Latest question: {latest_question}")
        
        # Convert messages to Anthropic format, capped to last MAX_CHAT_HISTORY
        anthropic_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages[-MAX_CHAT_HISTORY:]
        ]

        system_content = f"You are a helpful chemistry tutor discussing the topic: {request.node_id}. Keep responses concise and relevant (2-3 sentences)."

        # OPTIMIZATION: Run both API calls in parallel
        loop = asyncio.get_event_loop()

        chat_task = loop.run_in_executor(
            executor,
            get_chat_response,
            system_content,
            anthropic_messages
        )
        
        curiosity_task = loop.run_in_executor(
            executor,
            evaluate_curiosity,
            latest_question,
            request.node_id
        )
        
        # Wait for both to complete
        assistant_message, curiosity_eval = await asyncio.gather(chat_task, curiosity_task)

        print(f"Curiosity evaluation: {curiosity_eval}")

        # Build updated chat history
        updated_messages = request.messages + [Message(role="assistant", content=assistant_message)]
        chat_history = [
            {"role": msg.role, "content": msg.content}
            for msg in updated_messages[-MAX_CHAT_HISTORY:]
        ]

        # Save chat history in background (doesn't affect response data)
        background_tasks.add_task(
            save_chat_history_background,
            user_id,
            request.node_id,
            chat_history
        )

        # Process curiosity score inline so new score is returned with the response
        is_curious = curiosity_eval.get("is_curious", False)
        if is_curious:
            score_result = await loop.run_in_executor(
                executor, process_curiosity_score, user_id, request.node_id
            )
        else:
            score_result = {"curiosity_score": None, "is_completed": False}

        response_data = {
            "message": assistant_message,
            "curiosity_increased": is_curious,
            "curiosity_reason": curiosity_eval.get("reason") if is_curious else None,
            "new_curiosity_score": score_result["curiosity_score"],
            "is_completed": score_result["is_completed"],
        }
        
        print(f"Response sent to user (background tasks queued)")
        return response_data
        
    except Exception as e:
        print(f"Anthropic API error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))