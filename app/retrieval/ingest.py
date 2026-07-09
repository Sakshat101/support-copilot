"""Ingest knowledge-base text chunks into the documents table."""
import psycopg
from app.config import settings
from app.retrieval.embed import embed


def ingest(chunks: list[str]) -> int:
    count = 0
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        for c in chunks:
            cur.execute(
                "INSERT INTO documents (content, embedding) VALUES (%s, %s)",
                (c, embed(c)),
            )
            count += 1
        conn.commit()
    return count


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Simple word-based sliding-window chunker."""
    words = text.split()
    chunks = []
    step = chunk_size - overlap
    for i in range(0, len(words), step):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks


if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "kb.txt"
    with open(path) as f:
        text = f.read()
    n = ingest(chunk_text(text))
    print(f"Ingested {n} chunks from {path}")
