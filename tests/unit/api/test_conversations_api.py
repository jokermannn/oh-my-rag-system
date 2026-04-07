from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from app.api.main import create_app
    app = create_app(embedder=MagicMock(), store=MagicMock(), llm=MagicMock())
    return TestClient(app)


def test_create_conversation(client):
    response = client.post("/conversations")
    assert response.status_code == 200
    assert "conversation_id" in response.json()


def test_get_conversation(client):
    create_resp = client.post("/conversations")
    conv_id = create_resp.json()["conversation_id"]
    response = client.get(f"/conversations/{conv_id}")
    assert response.status_code == 200
    assert response.json()["id"] == conv_id


def test_get_nonexistent_conversation_returns_404(client):
    response = client.get("/conversations/does-not-exist")
    assert response.status_code == 404


def test_delete_conversation(client):
    create_resp = client.post("/conversations")
    conv_id = create_resp.json()["conversation_id"]
    response = client.delete(f"/conversations/{conv_id}")
    assert response.status_code == 204
