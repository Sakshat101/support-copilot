"""Background jobs via arq (free, Redis-backed). Run with:
arq app.workers.tasks.WorkerSettings
"""
import datetime
import psycopg
from arq import cron
from arq.connections import RedisSettings
from app.config import settings


async def sla_monitor(ctx):
    """Escalate tickets that have passed their SLA due date."""
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE tickets SET status = 'escalated' "
            "WHERE status = 'open' AND sla_due_at < %s RETURNING id",
            (datetime.datetime.utcnow(),),
        )
        escalated = cur.fetchall()
        conn.commit()
    if escalated:
        print(f"Escalated {len(escalated)} overdue tickets")


async def ingest_kb_job(ctx, path: str):
    from app.retrieval.ingest import ingest, chunk_text
    with open(path) as f:
        text = f.read()
    n = ingest(chunk_text(text))
    print(f"Ingested {n} chunks from {path}")


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = [ingest_kb_job]
    cron_jobs = [cron(sla_monitor, minute=set(range(0, 60, 5)))]
