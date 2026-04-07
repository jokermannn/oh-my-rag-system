from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
import time

from app.api.deps import get_embedder, get_store, get_llm, get_prompt_builder
from app.models import QueryResult, TraceInfo

router = APIRouter()
FALLBACK_MSG = "在知识库中未找到与该问题相关的内容。"


class QueryRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None
    use_hyde: bool = False


@router.post("/query", response_model=QueryResult)
def query(
    req: QueryRequest,
    embedder=Depends(get_embedder),
    store=Depends(get_store),
    llm=Depends(get_llm),
    prompt_builder=Depends(get_prompt_builder),
):
    trace = TraceInfo()
    timings: dict[str, float] = {}

    t0 = time.monotonic()
    q_embedding = embedder.embed([req.question])[0]
    timings["embed_query"] = (time.monotonic() - t0) * 1000

    t0 = time.monotonic()
    child_chunks = store.search(query_vector=q_embedding, top_k=20)
    timings["vector_search"] = (time.monotonic() - t0) * 1000

    if not child_chunks:
        trace.timings = timings
        return QueryResult(answer=FALLBACK_MSG, sources=[], trace=trace)

    parent_ids = list({c.parent_id for c in child_chunks if c.parent_id})
    context_chunks = store.get_by_ids(parent_ids) if parent_ids else child_chunks[:5]

    if not context_chunks:
        trace.timings = timings
        return QueryResult(answer=FALLBACK_MSG, sources=[], trace=trace)

    t0 = time.monotonic()
    messages = prompt_builder.build(question=req.question, context_chunks=context_chunks)
    answer = llm.generate(messages)
    timings["llm_generate"] = (time.monotonic() - t0) * 1000

    trace.timings = timings
    return QueryResult(answer=answer, sources=context_chunks, trace=trace)
