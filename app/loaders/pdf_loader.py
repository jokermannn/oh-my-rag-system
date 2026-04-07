import fitz  # pymupdf

from app.loaders.base import BaseLoader
from app.models import Document


class PDFLoader(BaseLoader):
    def load(self, path_or_url: str) -> list[Document]:
        doc = fitz.open(path_or_url)
        pages_text = [page.get_text() for page in doc]
        content = "\n\n".join(pages_text).strip()
        return [
            Document(
                source=path_or_url,
                content=content,
                metadata={"doc_type": "pdf", "page_count": len(doc)},
            )
        ]
