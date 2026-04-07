from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.models import Chunk


def _make_chunk(id: str, parent_id: str = "p1") -> Chunk:
    return Chunk(id=id, document_id="d1", content=f"content {id}", level="child",
                 parent_id=parent_id, metadata={})


@pytest.fixture
def enhanced_client():
    from app.api.main import create_app
    mock_embedder = MagicMock()
    mock_embedder.embed.return_value = [[0.1] * 3]
    mock_store = MagicMock()
    mock_store.search.return_value = [_make_chunk("c1"), _make_chunk("c2")]
    mock_store.bm25_search.return_value = [_make_chunk("c2"), _make_chunk("c3")]
    mock_store.get_by_ids.return_value = [
        Chunk(id="p1", document_id="d1", content="parent context", level="parent", metadata={})
    ]
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "The answer is 42."
    mock_reranker = MagicMock()
    mock_reranker.rerank.return_value = [
        Chunk(id="p1", document_id="d1", content="parent context", level="parent", metadata={})
    ]

    app = create_app(
        embedder=mock_embedder,
        store=mock_store,
        llm=mock_llm,
        reranker=mock_reranker,
    )
    return TestClient(app)


def test_query_uses_hybrid_retrieval(enhanced_client):
    response = enhanced_client.post("/query", json={"question": "What is the answer?"})
    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "The answer is 42."


def test_query_with_hyde(enhanced_client):
    response = enhanced_client.post("/query", json={
        "question": "What is the answer?",
        "use_hyde": True
    })
    assert response.status_code == 200
