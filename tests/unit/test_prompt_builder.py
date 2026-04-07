import pytest

from app.models import Chunk, Message
from app.prompt.builder import PromptBuilder


def _make_chunk(content: str) -> Chunk:
    return Chunk(id="c1", document_id="d1", content=content, level="parent", metadata={})


def test_build_returns_messages():
    builder = PromptBuilder()
    chunks = [_make_chunk("Python is a language."), _make_chunk("It was created in 1991.")]
    messages = builder.build(question="When was Python created?", context_chunks=chunks)
    assert isinstance(messages, list)
    assert all(isinstance(m, Message) for m in messages)


def test_context_chunks_appear_in_messages():
    builder = PromptBuilder()
    chunks = [_make_chunk("Important fact here.")]
    messages = builder.build(question="What fact?", context_chunks=chunks)
    full_text = " ".join(m.content for m in messages)
    assert "Important fact here." in full_text


def test_question_appears_in_messages():
    builder = PromptBuilder()
    messages = builder.build(question="What is 42?", context_chunks=[_make_chunk("ctx")])
    full_text = " ".join(m.content for m in messages)
    assert "What is 42?" in full_text


def test_empty_context_raises():
    builder = PromptBuilder()
    with pytest.raises(ValueError, match="context_chunks"):
        builder.build(question="Q?", context_chunks=[])
