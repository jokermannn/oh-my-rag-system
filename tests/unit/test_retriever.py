from app.retriever.retriever import HybridRetriever, rrf_fuse
from app.models import Chunk


def _make_chunk(id: str, content: str) -> Chunk:
    return Chunk(id=id, document_id="d1", content=content, level="child", metadata={})


def test_rrf_fuse_merges_rankings():
    list_a = [_make_chunk("a", "text a"), _make_chunk("b", "text b")]
    list_b = [_make_chunk("b", "text b"), _make_chunk("c", "text c")]
    result = rrf_fuse([list_a, list_b], k=60)
    ids = [c.id for c in result]
    assert ids[0] == "b"
    assert set(ids) == {"a", "b", "c"}


def test_rrf_fuse_returns_top_k():
    chunks = [_make_chunk(str(i), f"text {i}") for i in range(10)]
    result = rrf_fuse([chunks], k=60, top_k=5)
    assert len(result) == 5


def test_hybrid_retriever_calls_both_searches():
    from unittest.mock import MagicMock
    mock_store = MagicMock()
    mock_store.search.return_value = [_make_chunk("c1", "hello")]
    mock_store.bm25_search.return_value = [_make_chunk("c2", "world")]
    mock_embedder = MagicMock()
    mock_embedder.embed.return_value = [[0.1] * 3]

    retriever = HybridRetriever(store=mock_store, embedder=mock_embedder)
    results = retriever.retrieve("test query", top_k=10)

    mock_store.search.assert_called_once()
    mock_store.bm25_search.assert_called_once()
    assert len(results) <= 10
