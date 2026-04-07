import inspect
from unittest.mock import MagicMock

from app.embedder.base import BaseEmbedder
from app.embedder.openai_embedder import OpenAIEmbedder


def test_openai_embedder_calls_api():
    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=[0.1, 0.2, 0.3])]
    )
    embedder = OpenAIEmbedder(client=mock_client, model="text-embedding-3-small")
    result = embedder.embed(["hello world"])
    assert len(result) == 1
    assert result[0] == [0.1, 0.2, 0.3]
    mock_client.embeddings.create.assert_called_once()


def test_openai_embedder_batches_input():
    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=[0.1] * 3), MagicMock(embedding=[0.2] * 3)]
    )
    embedder = OpenAIEmbedder(client=mock_client, batch_size=2)
    result = embedder.embed(["a", "b"])
    assert len(result) == 2


def test_base_embedder_is_abstract():
    assert inspect.isabstract(BaseEmbedder)
