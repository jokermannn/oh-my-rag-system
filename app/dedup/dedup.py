from dataclasses import dataclass

from app.models import Document
from app.vectorstore.qdrant_store import QdrantStore


@dataclass
class DedupResult:
    is_duplicate: bool = False
    is_update: bool = False
    old_document_id: str | None = None


class DedupManager:
    def __init__(self, store: QdrantStore):
        self.store = store
        self._source_registry: dict[str, str] = {}

    def check(self, doc: Document) -> DedupResult:
        old_id = self._source_registry.get(doc.source)
        if old_id and old_id != doc.id:
            return DedupResult(is_update=True, old_document_id=old_id)
        existing = self.store.get_by_ids([doc.id])
        if existing:
            return DedupResult(is_duplicate=True)
        return DedupResult()

    def register(self, doc: Document) -> None:
        self._source_registry[doc.source] = doc.id
