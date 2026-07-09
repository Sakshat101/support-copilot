"""Hybrid retrieval: pgvector cosine similarity + Postgres full-text search,
merged with Reciprocal Rank Fusion (RRF)."""
import psycopg
from app.config import settings
from app.retrieval.embed import embed


def hybrid_search(query: str, k: int = 8, rrf_c: int = 60) -> list[dict]:
    qvec = embed(query)
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, content, embedding <=> %s::vector AS dist
            FROM documents ORDER BY dist ASC LIMIT %s
            """,
            (qvec, k * 2),
        )
        vector_hits = cur.fetchall()

        cur.execute(
            """
            SELECT id, content, ts_rank(tsv, plainto_tsquery('english', %s)) AS score
            FROM documents
            WHERE tsv @@ plainto_tsquery('english', %s)
            ORDER BY score DESC LIMIT %s
            """,
            (query, query, k * 2),
        )
        text_hits = cur.fetchall()

    def rrf(rank_lists):
        scores: dict[int, float] = {}
        for hits in rank_lists:
            for rank, row in enumerate(hits):
                doc_id = row[0]
                scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (rrf_c + rank + 1)
        return scores

    fused = rrf([vector_hits, text_hits])
    id_to_content = {r[0]: r[1] for r in list(vector_hits) + list(text_hits)}
    ranked = sorted(fused.items(), key=lambda x: -x[1])[:k]
    return [{"id": doc_id, "content": id_to_content[doc_id]} for doc_id, _ in ranked]
