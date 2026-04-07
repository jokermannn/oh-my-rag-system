from fastapi import FastAPI

import app.api.deps as deps
from app.api.routes import conversations, documents, ingest, jobs, query
from app.api.routes import eval as eval_router
from app.embedder.base import BaseEmbedder
from app.llm.base import BaseLLM
from app.reranker.base import BaseReranker
from app.vectorstore.qdrant_store import QdrantStore


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
    app.include_router(documents.router)
    return app
