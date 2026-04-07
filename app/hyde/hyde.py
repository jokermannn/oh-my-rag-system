from app.llm.base import BaseLLM
from app.embedder.base import BaseEmbedder
from app.models import Message

HYDE_PROMPT = "Write a short passage that would directly answer the following question:\n\n"


class HyDEGenerator:
    def __init__(self, llm: BaseLLM, embedder: BaseEmbedder):
        self.llm = llm
        self.embedder = embedder

    def generate(self, question: str) -> tuple[list[float], str | None]:
        question_vec = self.embedder.embed([question])[0]
        try:
            hypothesis = self.llm.generate([Message(role="user", content=HYDE_PROMPT + question)])
            hypothesis_vec = self.embedder.embed([hypothesis])[0]
            avg_vec = [(q + h) / 2.0 for q, h in zip(question_vec, hypothesis_vec)]
            return avg_vec, hypothesis
        except Exception:
            return question_vec, None
