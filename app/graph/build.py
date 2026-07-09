"""LangGraph state machine: retrieve -> draft -> grounding_check -> decide_action
-> (human_approval if needed) -> end. Checkpointed to Postgres so paused
approvals survive restarts."""
from typing import Literal

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.types import interrupt

from app.config import settings
from app.graph.state import SupportState
from app.retrieval.hybrid import hybrid_search
from app.llm import chat


def retrieve(state: SupportState) -> dict:
    hits = hybrid_search(state["message"])
    return {"context": hits}


def draft(state: SupportState) -> dict:
    ctx = "\n".join(h["content"] for h in state["context"])
    reply = chat([
        {"role": "system", "content": f"Answer the customer only using this context. If the context doesn't cover it, say you don't know.\n\nContext:\n{ctx}"},
        {"role": "user", "content": state["message"]},
    ])
    return {"draft": reply}


def grounding_check(state: SupportState) -> dict:
    ctx = "\n".join(h["content"] for h in state["context"])
    verdict = chat([
        {"role": "system", "content": "Reply with exactly YES or NO. Is the answer fully supported by the context, with no invented facts?"},
        {"role": "user", "content": f"Context:\n{ctx}\n\nAnswer:\n{state['draft']}"},
    ])
    return {"grounded": verdict.strip().upper().startswith("YES")}


def decide_action(state: SupportState) -> dict:
    msg = state["message"].lower()
    if "refund" in msg:
        return {"action": {"tool": "issue_refund", "needs_approval": True}}
    if "cancel" in msg:
        return {"action": {"tool": "cancel_order", "needs_approval": True}}
    return {"action": None}


def human_approval(state: SupportState) -> dict:
    decision = interrupt({"action": state["action"], "draft": state["draft"]})
    return {"approved": decision.get("approved", False)}


def route_after_decision(state: SupportState) -> Literal["human_approval", "__end__"]:
    return "human_approval" if state.get("action") else END


def build_graph():
    graph = StateGraph(SupportState)
    graph.add_node("retrieve", retrieve)
    graph.add_node("draft", draft)
    graph.add_node("grounding_check", grounding_check)
    graph.add_node("decide_action", decide_action)
    graph.add_node("human_approval", human_approval)

    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "draft")
    graph.add_edge("draft", "grounding_check")
    graph.add_edge("grounding_check", "decide_action")
    graph.add_conditional_edges("decide_action", route_after_decision)
    graph.add_edge("human_approval", END)

    checkpointer = PostgresSaver.from_conn_string(settings.database_url)
    checkpointer.setup()
    return graph.compile(checkpointer=checkpointer)


app_graph = build_graph()
