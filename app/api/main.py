from fastapi import FastAPI
from app.embedder.base import BaseEmbedder
from app.vectorstore.qdrant_store import QdrantStore
from app.llm.base import BaseLLM
from app.reranker.base import BaseReranker
import app.api.deps as deps
from app.api.routes import ingest, query, conversations, jobs
from app.api.routes import eval as eval_router


def create_app(
    embedder: BaseEmbedder,
    store: QdrantStore,
    llm: BaseLLM,
    reranker: BaseReranker | None = None,
) -> FastAPI:
    deps._embedder = embedder
    deps._store = store
    deps._llm = llm
    deps._reranker = reranker

    app = FastAPI(title="RAG System", version="0.4.0")
    app.include_router(ingest.router)
    app.include_router(query.router)
    app.include_router(conversations.router)
    app.include_router(jobs.router)
    app.include_router(eval_router.router)
    return app
