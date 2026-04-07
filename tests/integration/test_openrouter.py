"""
Integration tests for OpenRouterLLM — requires a real OPENROUTER_API_KEY.
Run with:
    OPENROUTER_API_KEY=sk-or-... pytest tests/integration/test_openrouter.py -v
"""
import os

import pytest

from app.llm.openrouter_llm import OpenRouterLLM
from app.models import Message

pytestmark = pytest.mark.skipif(
    not os.getenv("OPENROUTER_API_KEY"),
    reason="OPENROUTER_API_KEY not set",
)

MODEL = os.getenv("OPENROUTER_MODEL", "qwen/qwen3.6-plus:free")


@pytest.fixture(scope="module")
def llm():
    return OpenRouterLLM(model=MODEL)


def test_simple_response(llm):
    """Model returns a non-empty string."""
    result = llm.generate([Message(role="user", content="Reply with the single word: pong")])
    assert isinstance(result, str)
    assert len(result.strip()) > 0


def test_response_contains_expected_word(llm):
    """Model follows a simple instruction."""
    result = llm.generate([Message(role="user", content="What is 1 + 1? Answer with just the number.")])
    assert "2" in result


def test_system_message(llm):
    """System prompt is respected."""
    messages = [
        Message(role="system", content="You are a helpful assistant that always responds in exactly 3 words."),
        Message(role="user", content="How are you?"),
    ]
    result = llm.generate(messages)
    assert isinstance(result, str)
    assert len(result.strip()) > 0


def test_multi_turn(llm):
    """Multi-turn conversation maintains context."""
    messages = [
        Message(role="user", content="My name is Ada."),
        Message(role="assistant", content="Nice to meet you, Ada!"),
        Message(role="user", content="What is my name?"),
    ]
    result = llm.generate(messages)
    assert "Ada" in result


def test_rag_style_prompt(llm):
    """Model answers a RAG-style question from provided context."""
    context = "Python was created by Guido van Rossum and first released in 1991."
    messages = [
        Message(role="system", content=f"Answer only from this context:\n{context}"),
        Message(role="user", content="Who created Python?"),
    ]
    result = llm.generate(messages)
    assert "Guido" in result
