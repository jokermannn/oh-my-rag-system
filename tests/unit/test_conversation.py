from unittest.mock import MagicMock

import pytest

from app.conversation.manager import ConversationManager
from app.models import Conversation, Message


def test_create_conversation():
    manager = ConversationManager()
    conv = manager.create()
    assert isinstance(conv, Conversation)
    assert conv.id


def test_get_nonexistent_raises():
    manager = ConversationManager()
    with pytest.raises(KeyError):
        manager.get("nonexistent-id")


def test_add_message_and_retrieve():
    manager = ConversationManager()
    conv = manager.create()
    manager.add_message(conv.id, Message(role="user", content="Hello"))
    updated = manager.get(conv.id)
    assert len(updated.messages) == 1
    assert updated.messages[0].content == "Hello"


def test_rewrite_query_standalone():
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "What is the capital of France?"
    manager = ConversationManager(llm=mock_llm)
    conv = manager.create()
    manager.add_message(conv.id, Message(role="user", content="What about France?"))
    manager.add_message(conv.id, Message(role="assistant", content="France is in Europe."))
    rewritten = manager.rewrite_query(conv.id, "And its capital?")
    assert rewritten == "What is the capital of France?"
    mock_llm.generate.assert_called_once()


def test_rewrite_query_no_history_returns_original():
    manager = ConversationManager()
    conv = manager.create()
    result = manager.rewrite_query(conv.id, "What is Python?")
    assert result == "What is Python?"


def test_delete_conversation():
    manager = ConversationManager()
    conv = manager.create()
    manager.delete(conv.id)
    with pytest.raises(KeyError):
        manager.get(conv.id)
