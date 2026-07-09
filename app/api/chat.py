from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.graph.build import app_graph
from app.memory.store import write_episodic, write_semantic_if_durable
from app.auth.deps import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    customer_id: str
    message: str
    thread_id: str


@router.post("")
def send_message(req: ChatRequest, user: dict = Depends(get_current_user)):
    config = {"configurable": {"thread_id": req.thread_id}}
    result = app_graph.invoke(
        {"customer_id": req.customer_id, "message": req.message}, config
    )

    write_episodic(req.customer_id, req.message)
    write_semantic_if_durable(req.customer_id, req.message)

    return {
        "reply": result.get("draft"),
        "grounded": result.get("grounded"),
        "pending_action": result.get("action"),
        "thread_id": req.thread_id,
    }
