import anthropic

from app.llm.base import BaseLLM
from app.models import Message


class AnthropicLLM(BaseLLM):
    def __init__(self, client=None, model: str = "claude-sonnet-4-6", max_tokens: int = 1024):
        self.client = client or anthropic.Anthropic()
        self.model = model
        self.max_tokens = max_tokens

    def generate(self, messages: list[Message]) -> str:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        )
        return response.content[0].text
