import uuid

import tiktoken

from app.models import Chunk, Document


class HierarchicalChunker:
    def __init__(
        self,
        parent_size: int = 512,
        child_size: int = 128,
        child_overlap: int = 20,
        encoding_name: str = "cl100k_base",
    ):
        self.parent_size = parent_size
        self.child_size = child_size
        self.child_overlap = child_overlap
        self.enc = tiktoken.get_encoding(encoding_name)

    def _split_tokens(self, text: str, size: int, overlap: int) -> list[str]:
        tokens = self.enc.encode(text)
        chunks = []
        start = 0
        while start < len(tokens):
            end = min(start + size, len(tokens))
            chunks.append(self.enc.decode(tokens[start:end]))
            if end == len(tokens):
                break
            start += size - overlap
        return chunks

    def chunk(self, doc: Document) -> list[Chunk]:
        result: list[Chunk] = []
        parent_texts = self._split_tokens(doc.content, self.parent_size, 0)

        for parent_text in parent_texts:
            parent_id = str(uuid.uuid4())
            parent_chunk = Chunk(
                id=parent_id,
                document_id=doc.id,
                content=parent_text,
                level="parent",
                metadata={**doc.metadata, "source": doc.source},
            )
            result.append(parent_chunk)

            child_texts = self._split_tokens(parent_text, self.child_size, self.child_overlap)
            for child_text in child_texts:
                child_chunk = Chunk(
                    id=str(uuid.uuid4()),
                    document_id=doc.id,
                    content=child_text,
                    parent_id=parent_id,
                    level="child",
                    metadata={**doc.metadata, "source": doc.source},
                )
                result.append(child_chunk)

        return result
