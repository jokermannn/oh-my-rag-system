from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_embedder, get_llm
from app.eval.evaluator import RAGEvaluator

router = APIRouter()


class EvalRequest(BaseModel):
    question: str
    answer: str
    contexts: list[str]


class EvalResponse(BaseModel):
    faithfulness: float
    answer_relevance: float


@router.post("/eval", response_model=EvalResponse)
def evaluate(req: EvalRequest, llm=Depends(get_llm), embedder=Depends(get_embedder)):
    evaluator = RAGEvaluator(llm=llm, embedder=embedder)
    faithfulness = evaluator.faithfulness(answer=req.answer, contexts=req.contexts)
    relevance = evaluator.answer_relevance(question=req.question, answer=req.answer)
    return EvalResponse(faithfulness=faithfulness, answer_relevance=relevance)
