from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import psycopg
from app.config import settings
from app.auth.jwt import hash_password, verify_password, create_token, revoke_token
from app.auth.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str = "agent"


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(req: RegisterRequest):
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM users WHERE email = %s", (req.email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")
        cur.execute(
            "INSERT INTO users (email, password_hash, role) VALUES (%s, %s, %s)",
            (req.email, hash_password(req.password), req.role),
        )
        conn.commit()
    return {"status": "registered"}


@router.post("/login")
def login(req: LoginRequest):
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute("SELECT password_hash, role FROM users WHERE email = %s", (req.email,))
        row = cur.fetchone()
        if not row or not verify_password(req.password, row[0]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_token(user_id=req.email, role=row[1])
    return {"access_token": token, "token_type": "bearer"}


@router.post("/logout")
def logout(user: dict = Depends(get_current_user)):
    revoke_token(user["jti"])
    return {"status": "logged out"}
