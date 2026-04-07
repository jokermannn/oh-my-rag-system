import inspect
from unittest.mock import MagicMock, patch

import pytest

from app.llm.anthropic_llm import AnthropicLLM
from app.llm.base import BaseLLM
from app.llm.ollama_llm import OllamaLLM
from app.llm.openai_llm import OpenAILLM
from app.llm.openrouter_llm import OpenRouterLLM
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


def test_openrouter_llm_generate():
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="OpenRouter response"))]
    )
    with patch.dict("os.environ", {"OPENROUTER_API_KEY": "test-key"}):
        llm = OpenRouterLLM(model="qwen/qwen3.6-plus:free")
        llm.client = mock_client
    messages = [Message(role="user", content="Hi")]
    result = llm.generate(messages)
    assert result == "OpenRouter response"
    mock_client.chat.completions.create.assert_called_once_with(
        model="qwen/qwen3.6-plus:free",
        messages=[{"role": "user", "content": "Hi"}],
    )


def test_openrouter_llm_uses_env_model():
    with patch.dict("os.environ", {"OPENROUTER_API_KEY": "test-key", "OPENROUTER_MODEL": "custom/model"}):
        llm = OpenRouterLLM()
    assert llm.model == "custom/model"


def test_openrouter_llm_default_model():
    with patch.dict("os.environ", {"OPENROUTER_API_KEY": "test-key"}, clear=False):
        llm = OpenRouterLLM()
    assert llm.model == "openai/gpt-4o-mini"


def test_openrouter_llm_missing_key():
    with patch.dict("os.environ", {}, clear=True):
        with pytest.raises(KeyError):
            OpenRouterLLM()


def test_openrouter_llm_base_url():
    with patch.dict("os.environ", {"OPENROUTER_API_KEY": "test-key"}):
        llm = OpenRouterLLM()
    assert "openrouter.ai" in str(llm.client.base_url)


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
