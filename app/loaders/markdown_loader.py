from pathlib import Path

from app.loaders.base import BaseLoader
from app.models import Document


class MarkdownLoader(BaseLoader):
    def load(self, path_or_url: str) -> list[Document]:
        content = Path(path_or_url).read_text(encoding="utf-8")
        return [
            Document(
                source=path_or_url,
                content=content,
                metadata={"doc_type": "markdown"},
            )
        ]
