from unittest.mock import MagicMock
from app.vectorstore.qdrant_store import QdrantStore
from app.models import Chunk


def _make_chunk(id: str, content: str, level: str = "child", parent_id=None) -> Chunk:
    return Chunk(
        id=id, document_id="doc1", content=content,
        level=level, parent_id=parent_id, embedding=[0.1, 0.2, 0.3],
    )


def test_upsert_child_chunks_stores_vectors():
    mock_client = MagicMock()
    store = QdrantStore(client=mock_client, collection_name="test")
    chunks = [_make_chunk("c1", "text one"), _make_chunk("c2", "text two")]
    store.upsert(chunks)
    mock_client.upsert.assert_called_once()


def test_upsert_parent_chunks_no_vector():
    mock_client = MagicMock()
    store = QdrantStore(client=mock_client, collection_name="test")
    parent = _make_chunk("p1", "parent text", level="parent")
    parent.embedding = None
    store.upsert([parent])
    mock_client.upsert.assert_called_once()


def test_search_returns_chunks():
    mock_client = MagicMock()
    mock_client.search.return_value = [
        MagicMock(
            id="c1", score=0.9,
            payload={"document_id": "doc1", "content": "hello", "parent_id": "p1", "level": "child", "metadata": {}},
        )
    ]
    store = QdrantStore(client=mock_client, collection_name="test")
    results = store.search(query_vector=[0.1, 0.2, 0.3], top_k=5)
    assert len(results) == 1
    assert results[0].id == "c1"
    assert results[0].content == "hello"


def test_get_by_ids_returns_chunks():
    mock_client = MagicMock()
    mock_client.retrieve.return_value = [
        MagicMock(
            id="p1",
            payload={"document_id": "doc1", "content": "parent text", "parent_id": None, "level": "parent", "metadata": {}},
        )
    ]
    store = QdrantStore(client=mock_client, collection_name="test")
    chunks = store.get_by_ids(["p1"])
    assert chunks[0].id == "p1"
    assert chunks[0].level == "parent"
