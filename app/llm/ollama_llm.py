import httpx
from app.llm.base import BaseLLM
from app.models import Message


class OllamaLLM(BaseLLM):
    def __init__(self, model: str = "llama3", base_url: str = "http://localhost:11434"):
        self.model = model
        self.base_url = base_url

    def generate(self, messages: list[Message]) -> str:
        with httpx.Client(timeout=120) as client:
            response = client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": [{"role": m.role, "content": m.content} for m in messages],
                    "stream": False,
                },
            )
            response.raise_for_status()
            return response.json()["message"]["content"]
