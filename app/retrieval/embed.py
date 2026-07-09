"""Free local embedding model (no API cost, CPU-friendly)."""
from sentence_transformers import SentenceTransformer

_model = SentenceTransformer("BAAI/bge-small-en-v1.5")


def embed(text: str) -> list[float]:
    return _model.encode(text, normalize_embeddings=True).tolist()
