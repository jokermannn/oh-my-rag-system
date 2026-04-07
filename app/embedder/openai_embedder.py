from openai import OpenAI
from app.embedder.base import BaseEmbedder


class OpenAIEmbedder(BaseEmbedder):
    def __init__(self, client=None, model: str = "text-embedding-3-small", batch_size: int = 32):
        self.client = client or OpenAI()
        self.model = model
        self.batch_size = batch_size

    def embed(self, texts: list[str]) -> list[list[float]]:
        results: list[list[float]] = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            response = self.client.embeddings.create(input=batch, model=self.model)
            results.extend(item.embedding for item in response.data)
        return results
