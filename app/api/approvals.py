from fastapi import APIRouter, Depends
from app.graph.build import app_graph
from app.auth.deps import require_role

router = APIRouter(prefix="/approve", tags=["approvals"])


@router.post("/{thread_id}")
def approve(thread_id: str, approved: bool, user: dict = Depends(require_role("admin"))):
    config = {"configurable": {"thread_id": thread_id}}
    result = app_graph.invoke({"approved": approved}, config)
    return {"status": "resumed", "result": result}
