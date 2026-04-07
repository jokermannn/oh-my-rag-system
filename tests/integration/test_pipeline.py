from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from qdrant_client import QdrantClient

from app.api.main import create_app
from app.embedder.local_embedder import LocalEmbedder
from app.vectorstore.qdrant_store import QdrantStore


@pytest.fixture(scope="module")
def integration_client():
    client = QdrantClient(host="localhost", port=6333)
    store = QdrantStore(client=client, collection_name="test_integration", vector_size=384)
    store.ensure_collection()
    embedder = LocalEmbedder("sentence-transformers/all-MiniLM-L6-v2")

    mock_llm = MagicMock()
    mock_llm.generate.return_value = "Python was created by Guido van Rossum."

    app = create_app(embedder=embedder, store=store, llm=mock_llm)
    return TestClient(app)


@pytest.fixture(scope="module")
def ingested_doc(integration_client, tmp_path_factory):
    tmp = tmp_path_factory.mktemp("docs")
    md_file = tmp / "python.md"
    md_file.write_text(
        "# Python Programming Language\n\n"
        "Python was created by Guido van Rossum and first released in 1991. "
        "It emphasizes code readability and uses significant indentation. " * 10
    )
    response = integration_client.post("/ingest", json={
        "path_or_url": str(md_file),
        "doc_type": "markdown"
    })
    assert response.status_code == 200
    return response.json()["job_id"]


def test_ingest_returns_job_id(ingested_doc):
    assert ingested_doc is not None


def test_query_returns_answer(integration_client, ingested_doc):
    import time
    time.sleep(0.5)  # wait for async ingest to complete
    response = integration_client.post("/query", json={
        "question": "Who created Python?"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "Python was created by Guido van Rossum."
    assert "trace" in data
