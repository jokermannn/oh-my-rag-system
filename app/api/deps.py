from app.embedder.base import BaseEmbedder
from app.vectorstore.qdrant_store import QdrantStore
from app.llm.base import BaseLLM
from app.reranker.base import BaseReranker
from app.chunker.chunker import HierarchicalChunker
from app.prompt.builder import PromptBuilder
from app.jobs.queue import AsyncJobQueue

_embedder: BaseEmbedder | None = None
_store: QdrantStore | None = None
_llm: BaseLLM | None = None
_reranker: BaseReranker | None = None
_job_queue: AsyncJobQueue = AsyncJobQueue()
_chunker = HierarchicalChunker()
_prompt_builder = PromptBuilder()


def get_embedder() -> BaseEmbedder:
    return _embedder

def get_store() -> QdrantStore:
    return _store

def get_llm() -> BaseLLM:
    return _llm

def get_reranker() -> BaseReranker | None:
    return _reranker

def get_job_queue() -> AsyncJobQueue:
    return _job_queue

def get_chunker() -> HierarchicalChunker:
    return _chunker

def get_prompt_builder() -> PromptBuilder:
    return _prompt_builder
