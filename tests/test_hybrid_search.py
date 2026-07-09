from app.retrieval.ingest import ingest
from app.retrieval.hybrid import hybrid_search


def test_rrf_merges_both_sources(db_url):
    ingest(["Our refund policy allows returns within 30 days of purchase."])
    results = hybrid_search("refund policy")
    assert len(results) > 0
    assert any("refund" in r["content"].lower() for r in results)
