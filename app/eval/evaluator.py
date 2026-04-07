import math
from app.llm.base import BaseLLM
from app.embedder.base import BaseEmbedder
from app.models import Message

FAITHFULNESS_PROMPT = (
    "For each claim in the answer below, reply with YES if it is directly supported by "
    "the context, or NO if it is not. One answer per line, no explanation.\n\n"
    "Context:\n{context}\n\nAnswer claims:\n{claims}"
)

RELEVANCE_PROMPT = (
    "Given the following answer, generate the question that this answer most likely addresses. "
    "Return ONLY the question.\n\nAnswer: {answer}"
)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class RAGEvaluator:
    def __init__(self, llm: BaseLLM, embedder: BaseEmbedder | None = None):
        self.llm = llm
        self.embedder = embedder

    def faithfulness(self, answer: str, contexts: list[str]) -> float:
        claims = [s.strip() for s in answer.split(".") if s.strip()]
        if not claims:
            return 1.0
        context_text = "\n".join(contexts)
        prompt = FAITHFULNESS_PROMPT.format(
            context=context_text,
            claims="\n".join(f"- {c}" for c in claims),
        )
        response = self.llm.generate([Message(role="user", content=prompt)])
        verdicts = [line.strip().upper() for line in response.strip().splitlines()]
        yes_count = sum(1 for v in verdicts if v == "YES")
        return yes_count / len(verdicts) if verdicts else 1.0

    def answer_relevance(self, question: str, answer: str) -> float:
        if self.embedder is None:
            raise ValueError("embedder required for answer_relevance")
        generated_question = self.llm.generate([
            Message(role="user", content=RELEVANCE_PROMPT.format(answer=answer))
        ])
        q_vec = self.embedder.embed([question])[0]
        gen_vec = self.embedder.embed([generated_question])[0]
        return _cosine_similarity(q_vec, gen_vec)
