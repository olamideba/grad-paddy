"""
memory.py
─────────────────────
FastAPI endpoints that Kibana's Elastic Agent Builder calls as custom connectors.

Each endpoint maps to one MCP tool registered in Kibana:
  save_memory1    → POST /api/memory/save
  search_memory1  → POST /api/memory/search
  delete_memory1  → DELETE /api/memory/{memory_id}

The `user_id` is passed by the agent as a parameter (the agent knows it from
session state).  This keeps the connector interface simple and stateless.

Kibana connector registration (one-time setup per deployment):
  1. Kibana → Stack Management → Connectors → Create connector → Webhook
  2. Name: save_memory1 / search_memory1 / delete_memory1
  3. URL: <BACKEND_URL>/api/memory/save (or /search, /{memory_id})
  4. Method: POST / POST / DELETE
  5. Add connector to your Agent Builder agent
  6. Add tool name to ELASTIC_MCP_TOOL_FILTER in .env
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from src.services.memory_service import MemoryService

router = APIRouter(prefix="/api/memory", tags=["memory"])


class SaveMemoryRequest(BaseModel):
    user_id: str = Field(..., description="Authenticated user ID from agent session state.")
    fact: str = Field(..., description="Concise, self-contained fact about the user.")
    tags: list[str] = Field(default_factory=list, description="Topic tags for the memory.")
    session_id: str = Field(default="", description="Source session ID for provenance.")


class SearchMemoryRequest(BaseModel):
    user_id: str = Field(..., description="Authenticated user ID from agent session state.")
    query: str = Field(default="", description="Natural language search query. Empty returns most recent memories.")
    top_k: int = Field(default=8, ge=1, le=20)



@router.post("/save")
async def save_memory(body: SaveMemoryRequest) -> dict:
    """Persist a meaningful fact about the user to the Elastic user-memories index.

    Deduplicates via cosine similarity: if a nearly identical memory already
    exists for this user, the existing document is updated in-place rather than
    creating a duplicate.

    Called by the Kibana MCP connector registered as save_memory1.
    """
    result = await MemoryService.save_memory(
        user_id=body.user_id,
        fact=body.fact,
        tags=body.tags,
        session_id=body.session_id,
        source="conversation",
    )
    return {"success": True, "data": result}


@router.post("/search")
async def search_memory(body: SearchMemoryRequest) -> dict:
    """Retrieve relevant memories from the Elastic user-memories index.

    Uses hybrid kNN (semantic) + BM25 (keyword) search with recency boost.
    When query is empty, returns the most recently updated memories.

    Called by the Kibana MCP connector registered as search_memory1.
    """
    memories = await MemoryService.search_memory(
        user_id=body.user_id,
        query=body.query,
        top_k=body.top_k,
    )
    return {"success": True, "memories": memories, "count": len(memories)}


@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: str,
    user_id: str = Query(..., description="Authenticated user ID — verified against memory owner before deletion."),
) -> dict:
    """Delete a specific memory by ID, verifying user ownership first.

    Called by the Kibana MCP connector registered as delete_memory1.
    """
    result = await MemoryService.delete_memory(
        user_id=user_id,
        memory_id=memory_id,
    )
    return {"success": result["status"] == "deleted", "data": result}
