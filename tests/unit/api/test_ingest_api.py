import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path):
    from app.api.main import create_app
    mock_embedder = MagicMock()
    mock_embedder.embed.return_value = [[0.1] * 1536]
    mock_store = MagicMock()
    app = create_app(embedder=mock_embedder, store=mock_store, llm=MagicMock())
    return TestClient(app)


def test_ingest_markdown_returns_job_id(client, tmp_path):
    md_file = tmp_path / "test.md"
    md_file.write_text("# Hello\n\nThis is content.")
    response = client.post("/ingest", json={
        "path_or_url": str(md_file),
        "doc_type": "markdown"
    })
    assert response.status_code == 200
    assert "job_id" in response.json()


def test_ingest_unknown_type_returns_422(client):
    response = client.post("/ingest", json={
        "path_or_url": "/some/path.xyz",
        "doc_type": "unknown"
    })
    assert response.status_code == 422
