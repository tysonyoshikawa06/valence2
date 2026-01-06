from fastapi import APIRouter, HTTPException, Header, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List
import os
from openai import OpenAI
from database import execute_query
import jwt
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor

router = APIRouter()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

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

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": evaluation_prompt},
                {"role": "user", "content": question}
            ],
            max_tokens=150,
            temperature=0.3
        )

        result_text = response.choices[0].message.content.strip()
        
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

def get_chat_response(system_message: dict, openai_messages: list):
    """Get chat response from OpenAI"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[system_message] + openai_messages,
        max_tokens=500,
        temperature=0.7
    )
    return response.choices[0].message.content

def process_curiosity_score(user_id: str, node_id: str, is_curious: bool):
    """Background task to update curiosity score and completion status"""
    if not is_curious:
        return
    
    try:
        print(f"[Background] Processing curiosity score for {node_id}...")
        check_query = "SELECT curiosity_score, is_completed FROM user_nodes WHERE user_id = %s AND node_id = %s"
        check_result = execute_query(check_query, (user_id, node_id))
        
        if not check_result:
            print(f"ERROR: Node {node_id} not found for user {user_id}")
            return
        
        current_score = check_result[0]['curiosity_score']
        is_already_completed = check_result[0]['is_completed']
        print(f"Current curiosity score: {current_score}, Completed: {is_already_completed}")
        
        if current_score < 5 and not is_already_completed:
            update_query = """
                UPDATE user_nodes
                SET curiosity_score = curiosity_score + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = %s AND node_id = %s
                RETURNING curiosity_score
            """
            result = execute_query(update_query, (user_id, node_id))
            if result:
                new_score = result[0]['curiosity_score']
                print(f"✓ Curiosity score updated! New score: {new_score}")
                
                # Check if we just reached 5 - if so, complete the node
                if new_score >= 5:
                    print(f"Score reached {new_score}! Completing node...")
                    # Mark node as completed
                    complete_query = """
                        UPDATE user_nodes
                        SET is_completed = TRUE, updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = %s AND node_id = %s
                        RETURNING neighbors
                    """
                    complete_result = execute_query(complete_query, (user_id, node_id))
                    
                    if complete_result:
                        neighbors = complete_result[0]['neighbors']
                        print(f"✓ Node completed! Unlocking neighbors: {neighbors}")
                        
                        # Unlock all neighbors
                        if neighbors:
                            unlock_query = """
                                UPDATE user_nodes
                                SET is_unlocked = TRUE, updated_at = CURRENT_TIMESTAMP
                                WHERE user_id = %s AND node_id = ANY(%s)
                            """
                            execute_query(unlock_query, (user_id, neighbors), fetch=False)
                            print(f"✓ Neighbors unlocked: {neighbors}")
                            
    except Exception as e:
        print(f"ERROR processing curiosity score: {e}")
        import traceback
        traceback.print_exc()

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
        
        # Convert messages to OpenAI format
        openai_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]
        
        # System message
        system_message = {
            "role": "system",
            "content": f"You are a helpful chemistry tutor discussing the topic: {request.node_id}. Keep responses concise and relevant (2-3 sentences)."
        }
        
        # OPTIMIZATION: Run both API calls in parallel
        loop = asyncio.get_event_loop()
        
        chat_task = loop.run_in_executor(
            executor,
            get_chat_response,
            system_message,
            openai_messages
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
            for msg in updated_messages[-10:]
        ]
        
        # OPTIMIZATION: Save chat history in background
        background_tasks.add_task(
            save_chat_history_background,
            user_id,
            request.node_id,
            chat_history
        )
        
        # OPTIMIZATION: Process curiosity score in background
        is_curious = curiosity_eval.get("is_curious", False)
        background_tasks.add_task(
            process_curiosity_score,
            user_id,
            request.node_id,
            is_curious
        )
        
        # Return response immediately
        response_data = {
            "message": assistant_message,
            "curiosity_increased": is_curious,
            "curiosity_reason": curiosity_eval.get("reason") if is_curious else None
        }
        
        print(f"Response sent to user (background tasks queued)")
        return response_data
        
    except Exception as e:
        print(f"OpenAI API error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))