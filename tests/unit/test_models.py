from datetime import datetime

from app.models import Chunk, Conversation, Document, QueryResult, TraceInfo


def test_document_id_is_content_hash():
    doc = Document(source="test.md", content="hello world", metadata={})
    import hashlib
    expected = hashlib.sha256("hello world".encode()).hexdigest()
    assert doc.id == expected


def test_chunk_parent_id_none_for_parent_level():
    chunk = Chunk(
        id="abc",
        document_id="doc1",
        content="some text",
        level="parent",
        metadata={},
    )
    assert chunk.parent_id is None
    assert chunk.embedding is None


def test_conversation_has_created_at():
    conv = Conversation(id="c1", messages=[])
    assert isinstance(conv.created_at, datetime)


def test_query_result_structure():
    trace = TraceInfo(
        query_rewrite=None,
        hyde_doc=None,
        retrieval_scores=[],
        rerank_scores=[],
        timings={},
    )
    result = QueryResult(answer="42", sources=[], trace=trace)
    assert result.answer == "42"
