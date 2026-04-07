import inspect
from unittest.mock import MagicMock, patch

from app.llm.anthropic_llm import AnthropicLLM
from app.llm.base import BaseLLM
from app.llm.ollama_llm import OllamaLLM
from app.llm.openai_llm import OpenAILLM
from app.models import Message


def test_base_llm_is_abstract():
    assert inspect.isabstract(BaseLLM)


def test_openai_llm_generate():
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Hello!"))]
    )
    llm = OpenAILLM(client=mock_client)
    messages = [Message(role="user", content="Hi")]
    result = llm.generate(messages)
    assert result == "Hello!"


def test_anthropic_llm_generate():
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="Anthropic response")]
    )
    llm = AnthropicLLM(client=mock_client)
    messages = [Message(role="user", content="Hi")]
    result = llm.generate(messages)
    assert result == "Anthropic response"


def test_ollama_llm_generate():
    mock_response = MagicMock()
    mock_response.json.return_value = {"message": {"content": "Ollama response"}}
    mock_response.raise_for_status = MagicMock()

    import httpx
    with patch.object(httpx.Client, "post", return_value=mock_response):
        llm = OllamaLLM(model="llama3")
        messages = [Message(role="user", content="Hi")]
        result = llm.generate(messages)
    assert result == "Ollama response"
