from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client_and_store():
    from app.api.main import create_app
    mock_store = MagicMock()
    mock_store.list_documents.return_value = [
        {"id": "doc1", "source": "test.md", "version": 1, "chunk_count": 5}
    ]
    app = create_app(embedder=MagicMock(), store=mock_store, llm=MagicMock())
    return TestClient(app), mock_store


def test_list_documents(client_and_store):
    tc, _ = client_and_store
    response = tc.get("/documents")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_delete_document(client_and_store):
    tc, mock_store = client_and_store
    response = tc.delete("/documents/doc1")
    assert response.status_code == 204
    mock_store.delete_by_document_id.assert_called_once_with("doc1")
