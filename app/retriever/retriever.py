from app.embedder.base import BaseEmbedder
from app.models import Chunk
from app.vectorstore.qdrant_store import QdrantStore


def rrf_fuse(ranked_lists: list[list[Chunk]], k: int = 60, top_k: int = 10) -> list[Chunk]:
    scores: dict[str, float] = {}
    chunks_by_id: dict[str, Chunk] = {}
    for ranked in ranked_lists:
        for rank, chunk in enumerate(ranked, start=1):
            scores[chunk.id] = scores.get(chunk.id, 0.0) + 1.0 / (k + rank)
            chunks_by_id[chunk.id] = chunk
    sorted_ids = sorted(scores, key=lambda cid: scores[cid], reverse=True)
    return [chunks_by_id[cid] for cid in sorted_ids[:top_k]]


class HybridRetriever:
    def __init__(self, store: QdrantStore, embedder: BaseEmbedder, vector_top_k: int = 20, bm25_top_k: int = 20, rrf_k: int = 60):
        self.store = store
        self.embedder = embedder
        self.vector_top_k = vector_top_k
        self.bm25_top_k = bm25_top_k
        self.rrf_k = rrf_k

    def retrieve(self, query: str, top_k: int = 10) -> list[Chunk]:
        query_vector = self.embedder.embed([query])[0]
        vector_results = self.store.search(query_vector=query_vector, top_k=self.vector_top_k)
        bm25_results = self.store.bm25_search(query=query, top_k=self.bm25_top_k)
        return rrf_fuse([vector_results, bm25_results], k=self.rrf_k, top_k=top_k)
