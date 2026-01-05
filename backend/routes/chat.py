from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import List
import os
from openai import OpenAI
from database import execute_query
import jwt
import json

router = APIRouter()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

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
1. Connects the topic to broader chemical concepts or real-world phenomena
2. Shows interdisciplinary thinking (biology, physics, everyday life)
3. Asks "why" or "how does this relate to..." rather than just "what"
4. Questions implications, applications, or deeper mechanisms
5. Compares to other chemical phenomena or tries to find patterns

Respond ONLY with valid JSON in this exact format:
{{"is_curious": true/false, "reason": "brief explanation"}}

Examples of curious questions:
- "How does this relate to what happens in batteries?"
- "Why does this principle apply differently in living organisms?"
- "Could this explain why metals conduct electricity?"
- "How does this connect to climate change?"

Examples of NOT curious questions:
- "What is a mole?"
- "Can you explain this again?"
- "What's the formula?"
- "Help me with my homework"
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
async def chat(request: ChatRequest, user_id: str = Depends(get_current_user_id)):
    try:
        print(f"Chat request - User ID: {user_id}, Node ID: {request.node_id}")
        
        # Get the user's latest question
        user_messages = [msg for msg in request.messages if msg.role == "user"]
        if not user_messages:
            raise HTTPException(status_code=400, detail="No user message found")
        
        latest_question = user_messages[-1].content
        print(f"Latest question: {latest_question}")
        
        # Evaluate curiosity of the question
        curiosity_eval = evaluate_curiosity(latest_question, request.node_id)
        print(f"Curiosity evaluation: {curiosity_eval}")
        
        # Convert messages to OpenAI format
        openai_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]
        
        # Add system message with context about the node
        system_message = {
            "role": "system",
            "content": f"You are a helpful chemistry tutor discussing the topic: {request.node_id}. Keep responses concise and relevant. Encourage curious thinking and connections to broader concepts."
        }
        
        # Call OpenAI API for the main response
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[system_message] + openai_messages,
            max_tokens=500,
            temperature=0.7
        )
        
        assistant_message = response.choices[0].message.content
        
        # Build updated chat history (last 10 messages including new assistant response)
        updated_messages = request.messages + [Message(role="assistant", content=assistant_message)]
        chat_history = [
            {"role": msg.role, "content": msg.content}
            for msg in updated_messages[-10:]  # Keep only last 10
        ]
        
        # Save chat history to database
        try:
            save_query = """
                UPDATE user_nodes
                SET chat_history = %s::jsonb,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = %s AND node_id = %s
            """
            execute_query(save_query, (json.dumps(chat_history), user_id, request.node_id), fetch=False)
            print(f"✓ Chat history saved ({len(chat_history)} messages)")
        except Exception as e:
            print(f"Error saving chat history: {e}")
        
        # If question was curious, increment curiosity score
        curiosity_increased = False
        if curiosity_eval.get("is_curious"):
            print(f"Question is curious! Attempting to update score...")
            try:
                check_query = "SELECT curiosity_score FROM user_nodes WHERE user_id = %s AND node_id = %s"
                check_result = execute_query(check_query, (user_id, request.node_id))
                
                if not check_result:
                    print(f"ERROR: Node {request.node_id} not found for user {user_id}")
                else:
                    current_score = check_result[0]['curiosity_score']
                    print(f"Current curiosity score: {current_score}")
                    
                    if current_score < 5:
                        update_query = """
                            UPDATE user_nodes
                            SET curiosity_score = curiosity_score + 1,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE user_id = %s AND node_id = %s
                            RETURNING curiosity_score
                        """
                        result = execute_query(update_query, (user_id, request.node_id))
                        if result:
                            curiosity_increased = True
                            new_score = result[0]['curiosity_score']
                            print(f"✓ Curiosity score updated! New score: {new_score}")
                    else:
                        print(f"Score already at maximum (5)")
                        
            except Exception as e:
                print(f"ERROR updating curiosity score: {e}")
                import traceback
                traceback.print_exc()
        
        response_data = {
            "message": assistant_message,
            "curiosity_increased": curiosity_increased,
            "curiosity_reason": curiosity_eval.get("reason") if curiosity_increased else None
        }
        
        print(f"Response data: {response_data}")
        return response_data
        
    except Exception as e:
        print(f"OpenAI API error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))