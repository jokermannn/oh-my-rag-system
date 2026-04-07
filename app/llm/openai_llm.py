from openai import OpenAI

from app.llm.base import BaseLLM
from app.models import Message


class OpenAILLM(BaseLLM):
    def __init__(self, client=None, model: str = "gpt-4o-mini"):
        self.client = client or OpenAI()
        self.model = model

    def generate(self, messages: list[Message]) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        )
        return response.choices[0].message.content or ""
