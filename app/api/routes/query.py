import time
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_embedder, get_llm, get_prompt_builder, get_reranker, get_store
from app.hyde.hyde import HyDEGenerator
from app.models import QueryResult, TraceInfo
from app.retriever.retriever import rrf_fuse

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
    reranker=Depends(get_reranker),
):
    trace = TraceInfo()
    timings: dict[str, float] = {}
    question = req.question

    # conversation rewrite
    if req.conversation_id:
        from app.api.routes.conversations import _manager as conv_manager
        try:
            question = conv_manager.rewrite_query(req.conversation_id, question)
            if question != req.question:
                trace.query_rewrite = question
        except KeyError:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Conversation not found")

    # HyDE: generate hypothetical doc and average embeddings
    if req.use_hyde:
        t0 = time.monotonic()
        hyde = HyDEGenerator(llm=llm, embedder=embedder)
        query_vector, hypothesis = hyde.generate(question)
        trace.hyde_doc = hypothesis
        timings["hyde"] = (time.monotonic() - t0) * 1000
    else:
        t0 = time.monotonic()
        query_vector = embedder.embed([question])[0]
        timings["embed_query"] = (time.monotonic() - t0) * 1000

    # Hybrid retrieval
    t0 = time.monotonic()
    vector_chunks = store.search(query_vector=query_vector, top_k=20)
    bm25_chunks = store.bm25_search(query=question, top_k=20)
    fused = rrf_fuse([vector_chunks, bm25_chunks], top_k=10)
    timings["retrieval"] = (time.monotonic() - t0) * 1000

    if not fused:
        trace.timings = timings
        return QueryResult(answer=FALLBACK_MSG, sources=[], trace=trace)

    # Reranking
    if reranker:
        t0 = time.monotonic()
        fused = reranker.rerank(query=question, chunks=fused, top_k=5)
        timings["rerank"] = (time.monotonic() - t0) * 1000

    # Parent chunk recall
    parent_ids = list({c.parent_id for c in fused if c.parent_id})
    context_chunks = store.get_by_ids(parent_ids) if parent_ids else fused[:5]

    if not context_chunks:
        trace.timings = timings
        return QueryResult(answer=FALLBACK_MSG, sources=[], trace=trace)

    # Generate answer
    t0 = time.monotonic()
    messages = prompt_builder.build(question=question, context_chunks=context_chunks)
    answer = llm.generate(messages)
    timings["llm_generate"] = (time.monotonic() - t0) * 1000

    trace.timings = timings
    return QueryResult(answer=answer, sources=context_chunks, trace=trace)
