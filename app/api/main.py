from fastapi import FastAPI
from app.embedder.base import BaseEmbedder
from app.vectorstore.qdrant_store import QdrantStore
from app.llm.base import BaseLLM
import app.api.deps as deps
from app.api.routes import ingest, query


def create_app(
    embedder: BaseEmbedder,
    store: QdrantStore,
    llm: BaseLLM,
    reranker=None,
) -> FastAPI:
    deps._embedder = embedder
    deps._store = store
    deps._llm = llm

    app = FastAPI(title="RAG System", version="0.1.0")
    app.include_router(ingest.router)
    app.include_router(query.router)
    return app
