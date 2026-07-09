from fastapi import FastAPI
from app.api import auth, chat, approvals

app = FastAPI(title="Support Copilot (Free Edition)")

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(approvals.router)


@app.get("/health")
def health():
    return {"status": "ok"}
