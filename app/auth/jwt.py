"""JWT issuing + a revocation list (jti tracked in Postgres) — closes the gap
the original project's README flagged as missing."""
import uuid
import datetime
import psycopg
from jose import jwt, JWTError
from passlib.hash import bcrypt
from app.config import settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.verify(password, password_hash)


def create_token(user_id: str, role: str, expires_hours: int = 8) -> str:
    jti = str(uuid.uuid4())
    payload = {
        "sub": user_id,
        "role": role,
        "jti": jti,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=expires_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])


def revoke_token(jti: str) -> None:
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO revoked_tokens (jti) VALUES (%s) ON CONFLICT DO NOTHING",
            (jti,),
        )
        conn.commit()


def is_revoked(jti: str) -> bool:
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM revoked_tokens WHERE jti = %s", (jti,))
        return cur.fetchone() is not None
