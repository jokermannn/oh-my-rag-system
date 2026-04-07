from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.models import Chunk


class QdrantStore:
    def __init__(self, client=None, collection_name: str = "rag_chunks", vector_size: int = 1536, host: str = "localhost", port: int = 6333):
        self.client = client or QdrantClient(host=host, port=port)
        self.collection_name = collection_name
        self.vector_size = vector_size

    def ensure_collection(self) -> None:
        existing = [c.name for c in self.client.get_collections().collections]
        if self.collection_name not in existing:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=self.vector_size, distance=Distance.COSINE),
            )

    def upsert(self, chunks: list[Chunk]) -> None:
        points = []
        for chunk in chunks:
            payload = {
                "document_id": chunk.document_id,
                "content": chunk.content,
                "parent_id": chunk.parent_id,
                "level": chunk.level,
                "metadata": chunk.metadata,
            }
            if chunk.embedding:
                points.append(PointStruct(id=chunk.id, vector=chunk.embedding, payload=payload))
            else:
                points.append(PointStruct(
                    id=chunk.id,
                    vector=[0.0] * self.vector_size,
                    payload={**payload, "is_parent": True},
                ))
        self.client.upsert(collection_name=self.collection_name, points=points)

    def search(self, query_vector: list[float], top_k: int = 20) -> list[Chunk]:
        results = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            limit=top_k,
        ).points
        return [self._point_to_chunk(r.id, r.payload) for r in results]

    def get_by_ids(self, ids: list[str]) -> list[Chunk]:
        results = self.client.retrieve(
            collection_name=self.collection_name,
            ids=ids,
            with_payload=True,
        )
        return [self._point_to_chunk(r.id, r.payload) for r in results]

    def delete_by_document_id(self, document_id: str) -> None:
        from qdrant_client.models import FieldCondition, Filter, MatchValue
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=Filter(
                must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
            ),
        )

    def bm25_search(self, query: str, top_k: int = 20) -> list[Chunk]:
        """BM25 keyword search approximation using sparse encoding."""
        tokens = query.lower().split()
        token_freq: dict[int, float] = {}
        for token in tokens:
            idx = abs(hash(token)) % 50000
            token_freq[idx] = token_freq.get(idx, 0.0) + 1.0

        try:
            from qdrant_client.models import SparseVector
            results = self.client.query_points(
                collection_name=self.collection_name,
                query=SparseVector(
                    indices=list(token_freq.keys()),
                    values=list(token_freq.values()),
                ),
                using="bm25",
                limit=top_k,
            ).points
            return [self._point_to_chunk(r.id, r.payload) for r in results]
        except Exception:
            return []

    def list_documents(self) -> list[dict]:
        seen: dict[str, dict] = {}
        offset = None
        while True:
            points, offset = self.client.scroll(
                collection_name=self.collection_name,
                limit=100,
                offset=offset,
                with_payload=True,
            )
            for point in points:
                doc_id = point.payload.get("document_id", "unknown")
                if doc_id not in seen:
                    seen[doc_id] = {
                        "id": doc_id,
                        "source": point.payload.get("metadata", {}).get("source", ""),
                        "version": point.payload.get("metadata", {}).get("version", 1),
                        "chunk_count": 0,
                    }
                seen[doc_id]["chunk_count"] += 1
            if offset is None:
                break
        return list(seen.values())

    def _point_to_chunk(self, point_id, payload: dict) -> Chunk:
        return Chunk(
            id=str(point_id),
            document_id=payload["document_id"],
            content=payload["content"],
            parent_id=payload.get("parent_id"),
            level=payload["level"],
            metadata=payload.get("metadata", {}),
        )
