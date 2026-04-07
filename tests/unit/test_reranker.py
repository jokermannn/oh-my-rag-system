import inspect

from app.models import Chunk
from app.reranker.base import BaseReranker
from app.reranker.cross_encoder_reranker import CrossEncoderReranker


def _make_chunk(id: str, content: str) -> Chunk:
    return Chunk(id=id, document_id="d1", content=content, level="child", metadata={})


def test_base_reranker_is_abstract():
    assert inspect.isabstract(BaseReranker)


def test_cross_encoder_reranker_orders_by_score():
    from unittest.mock import MagicMock
    mock_model = MagicMock()
    mock_model.predict.return_value = [0.2, 0.9, 0.5]

    reranker = CrossEncoderReranker.__new__(CrossEncoderReranker)
    reranker.model = mock_model

    chunks = [
        _make_chunk("c1", "irrelevant text"),
        _make_chunk("c2", "highly relevant answer"),
        _make_chunk("c3", "somewhat relevant"),
    ]
    result = reranker.rerank(query="test query", chunks=chunks, top_k=2)
    assert len(result) == 2
    assert result[0].id == "c2"
    assert result[1].id == "c3"


def test_reranker_respects_top_k():
    from unittest.mock import MagicMock
    mock_model = MagicMock()
    mock_model.predict.return_value = [0.1, 0.9, 0.5, 0.3, 0.7]

    chunks = [_make_chunk(str(i), f"text {i}") for i in range(5)]
    reranker = CrossEncoderReranker.__new__(CrossEncoderReranker)
    reranker.model = mock_model
    result = reranker.rerank(query="q", chunks=chunks, top_k=3)
    assert len(result) == 3
