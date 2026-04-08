from pathlib import Path

import httpx
from bs4 import BeautifulSoup

from app.loaders.base import BaseLoader
from app.models import Document


class HTMLLoader(BaseLoader):
    def load(self, path_or_url: str) -> list[Document]:
        if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
            response = httpx.get(path_or_url, follow_redirects=True, timeout=30, verify=False)
            response.raise_for_status()
            raw_html = response.text
            doc_type = "url"
        else:
            raw_html = Path(path_or_url).read_text(encoding="utf-8")
            doc_type = "html"

        soup = BeautifulSoup(raw_html, "html.parser")
        for tag in soup(["script", "style"]):
            tag.decompose()
        content = soup.get_text(separator="\n", strip=True)

        return [
            Document(
                source=path_or_url,
                content=content,
                metadata={"doc_type": doc_type},
            )
        ]
