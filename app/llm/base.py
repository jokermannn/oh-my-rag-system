from abc import ABC, abstractmethod

from app.models import Message


class BaseLLM(ABC):
    @abstractmethod
    def generate(self, messages: list[Message]) -> str:
        ...
