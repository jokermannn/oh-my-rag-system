from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from app.api.main import create_app
    mock_embedder = MagicMock()
    mock_embedder.embed.return_value = [[0.1] * 1536]
    mock_store = MagicMock()
    mock_store.search.return_value = []
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "42"
    app = create_app(embedder=mock_embedder, store=mock_store, llm=mock_llm)
    return TestClient(app)


def test_query_with_no_results_returns_fallback(client):
    response = client.post("/query", json={"question": "What is the answer?"})
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "sources" in data
    assert "trace" in data


def test_query_missing_question_returns_422(client):
    response = client.post("/query", json={})
    assert response.status_code == 422
