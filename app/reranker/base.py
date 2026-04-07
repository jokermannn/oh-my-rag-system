from abc import ABC, abstractmethod
from app.models import Chunk


class BaseReranker(ABC):
    @abstractmethod
    def rerank(self, query: str, chunks: list[Chunk], top_k: int = 5) -> list[Chunk]:
        ...
