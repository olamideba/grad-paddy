"""
memory.py
─────────────────────
Optional REST surface over the user's long-term memory bank.

These endpoints are a thin HTTP wrapper around MemoryService for use by the
frontend (e.g. a "Memories" settings page where a user can view/forget facts).

NOTE: Agents do NOT use these endpoints. The agent reaches memory directly
through native ADK tools (agents/memory_tools.py → MemoryService) and the root
proactive-injection callback — no Elastic Agent Builder MCP round-trip. Keeping
memory orchestration in-process avoids a pointless agent → Kibana → webhook →
backend hop, and lets us run the multi-step embed/dedup logic that an Agent
Builder tool cannot express.
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
    """Delete a specific memory by ID, verifying user ownership first."""
    result = await MemoryService.delete_memory(
        user_id=user_id,
        memory_id=memory_id,
    )
    return {"success": result["status"] == "deleted", "data": result}
