import os

from openai import OpenAI

from app.llm.base import BaseLLM
from app.models import Message


class OpenRouterLLM(BaseLLM):
    """LLM client for OpenRouter (openai-compatible API).

    Env vars:
      OPENROUTER_API_KEY   required
      OPENROUTER_MODEL     default: openai/gpt-4o-mini
    """

    def __init__(self, model: str | None = None):
        self.model = model or os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
        self.client = OpenAI(
            api_key=os.environ["OPENROUTER_API_KEY"],
            base_url="https://openrouter.ai/api/v1",
        )

    def generate(self, messages: list[Message]) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        )
        return response.choices[0].message.content or ""
