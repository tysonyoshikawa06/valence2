from fastapi import APIRouter, HTTPException, Header, Depends
from database import execute_query
import jwt
import os
import json

router = APIRouter()

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

def get_current_user_id(authorization: str = Header(None)):
    """Extract user ID from JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")  # Returns UUID as string
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/initialize-graph")
async def initialize_graph(user_id: str = Depends(get_current_user_id)):
    """Initialize user's graph nodes from apchem.json"""
    try:
        # Load the graph data
        with open('public/data/apchem.json', 'r') as f:
            graph_data = json.load(f)
        
        # Check if user already has nodes initialized
        check_query = "SELECT COUNT(*) as count FROM user_nodes WHERE user_id = %s"
        result = execute_query(check_query, (user_id,))
        
        if result[0]['count'] > 0:
            return {"message": "Graph already initialized", "nodes_count": result[0]['count']}
        
        # Build a map of node_id -> neighbors
        neighbors_map = {}
        
        for node in graph_data['nodes']:
            node_id = node['data']['id']
            neighbors_map[node_id] = []
        
        # Process edges to build neighbor lists
        for edge in graph_data['edges']:
            source = edge['data']['source']
            target = edge['data']['target']
            
            if source in neighbors_map:
                neighbors_map[source].append(target)
            if target in neighbors_map:
                neighbors_map[target].append(source)
        
        # Insert all nodes for this user
        insert_query = """
            INSERT INTO user_nodes (user_id, node_id, neighbors, is_completed, curiosity_score, is_unlocked)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        nodes_inserted = 0
        for node in graph_data['nodes']:
            node_id = node['data']['id']
            neighbors = neighbors_map.get(node_id, [])
            is_unlocked = (node_id == "moles") # only moles node is unlocked at start
            
            execute_query(
                insert_query,
                (user_id, node_id, neighbors, False, 0, is_unlocked),
                fetch=False
            )
            nodes_inserted += 1
        
        return {
            "message": "Graph initialized successfully",
            "nodes_count": nodes_inserted
        }
        
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Graph data file not found")
    except Exception as e:
        print(f"Error initializing graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user-nodes")
async def get_user_nodes(user_id: str = Depends(get_current_user_id)):
    """Get all nodes for the current user"""
    query = """
        SELECT node_id, neighbors, is_completed, curiosity_score, is_unlocked
        FROM user_nodes
        WHERE user_id = %s
    """
    nodes = execute_query(query, (user_id,))
    return {"nodes": nodes}

@router.patch("/user-nodes/{node_id}/complete")
async def complete_node(node_id: str, user_id: str = Depends(get_current_user_id)):
    """Mark a node as completed and unlock its neighbors"""
    try:
        update_query = """
            UPDATE user_nodes
            SET is_completed = TRUE, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND node_id = %s
            RETURNING neighbors
        """
        result = execute_query(update_query, (user_id, node_id))
        
        if not result:
            raise HTTPException(status_code=404, detail="Node not found")
        
        neighbors = result[0]['neighbors']
        
        for neighbor_id in neighbors:
            neighbor_query = """
                SELECT neighbors FROM user_nodes
                WHERE user_id = %s AND node_id = %s
            """
            neighbor_data = execute_query(neighbor_query, (user_id, neighbor_id))
            
            if neighbor_data:
                neighbor_neighbors = neighbor_data[0]['neighbors']
                
                check_query = """
                    SELECT COUNT(*) as total,
                           SUM(CASE WHEN is_completed THEN 1 ELSE 0 END) as completed
                    FROM user_nodes
                    WHERE user_id = %s AND node_id = ANY(%s)
                """
                counts = execute_query(check_query, (user_id, neighbor_neighbors))
                
                total = counts[0]['total']
                completed = counts[0]['completed'] or 0
                
                if total > 0 and total == completed:
                    unlock_query = """
                        UPDATE user_nodes
                        SET is_unlocked = TRUE, updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = %s AND node_id = %s
                    """
                    execute_query(unlock_query, (user_id, neighbor_id), fetch=False)
        
        return {"message": "Node completed successfully", "unlocked_neighbors": neighbors}
        
    except Exception as e:
        print(f"Error completing node: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/user-nodes/{node_id}/curiosity")
async def update_curiosity_score(
    node_id: str,
    score_delta: int,
    user_id: str = Depends(get_current_user_id) 
):
    """Update curiosity score for a node"""
    update_query = """
        UPDATE user_nodes
        SET curiosity_score = curiosity_score + %s, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = %s AND node_id = %s
        RETURNING curiosity_score
    """
    result = execute_query(update_query, (score_delta, user_id, node_id))
    
    if not result:
        raise HTTPException(status_code=404, detail="Node not found")
    
    return {"curiosity_score": result[0]['curiosity_score']}