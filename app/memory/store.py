"""Episodic memory (every turn, recency-based) vs. semantic memory
(durable facts, selectively written) per customer."""
import psycopg
from app.config import settings
from app.retrieval.embed import embed
from app.llm import chat


def write_episodic(customer_id: str, turn: str) -> None:
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO episodic_memory (customer_id, turn, embedding) VALUES (%s, %s, %s)",
            (customer_id, turn, embed(turn)),
        )
        conn.commit()


def write_semantic_if_durable(customer_id: str, message: str) -> bool:
    verdict = chat([
        {"role": "system", "content": "Reply YES or NO only. Is this message a durable fact worth remembering long-term about the customer (preference, address, recurring issue)? Say NO for one-off questions."},
        {"role": "user", "content": message},
    ])
    if not verdict.strip().upper().startswith("YES"):
        return False
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO semantic_memory (customer_id, fact, embedding) VALUES (%s, %s, %s)",
            (customer_id, message, embed(message)),
        )
        conn.commit()
    return True


def recall_semantic(customer_id: str, query: str, k: int = 3) -> list[str]:
    qvec = embed(query)
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT fact FROM semantic_memory
            WHERE customer_id = %s
            ORDER BY embedding <=> %s::vector ASC LIMIT %s
            """,
            (customer_id, qvec, k),
        )
        return [r[0] for r in cur.fetchall()]
