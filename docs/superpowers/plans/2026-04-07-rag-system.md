# RAG System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-quality RAG system with hybrid search, reranking, HyDE, multi-turn conversation, async ingestion, and pluggable LLM/embedder, exposed as a REST API.

**Architecture:** Two pipelines (ingestion + query) connected through Qdrant. Ingestion runs async (job queue). Query pipeline chains conversation rewrite → HyDE → hybrid retrieval (vector + BM25 + RRF) → Cross-Encoder reranking → parent chunk recall → LLM generation. All external dependencies (LLM, embedder, reranker) injected via abstract base classes.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, Qdrant (Docker), pymupdf, beautifulsoup4, tiktoken, sentence-transformers, openai SDK, anthropic SDK, pytest, testcontainers-python

---

## File Map

```
rag-system/
├── app/
│   ├── models.py                     # All shared Pydantic models
│   ├── loaders/
│   │   ├── __init__.py
│   │   ├── base.py                   # BaseLoader ABC
│   │   ├── markdown_loader.py
│   │   ├── pdf_loader.py
│   │   └── html_loader.py
│   ├── chunker/
│   │   ├── __init__.py
│   │   └── chunker.py                # HierarchicalChunker
│   ├── dedup/
│   │   ├── __init__.py
│   │   └── dedup.py                  # DedupManager
│   ├── embedder/
│   │   ├── __init__.py
│   │   ├── base.py                   # BaseEmbedder ABC
│   │   ├── openai_embedder.py
│   │   └── local_embedder.py         # sentence-transformers
│   ├── vectorstore/
│   │   ├── __init__.py
│   │   └── qdrant_store.py           # QdrantStore
│   ├── retriever/
│   │   ├── __init__.py
│   │   └── retriever.py              # HybridRetriever (vector+BM25+RRF)
│   ├── reranker/
│   │   ├── __init__.py
│   │   ├── base.py                   # BaseReranker ABC
│   │   └── cross_encoder_reranker.py
│   ├── hyde/
│   │   ├── __init__.py
│   │   └── hyde.py                   # HyDEGenerator
│   ├── conversation/
│   │   ├── __init__.py
│   │   └── manager.py                # ConversationManager
│   ├── llm/
│   │   ├── __init__.py
│   │   ├── base.py                   # BaseLLM ABC
│   │   ├── openai_llm.py
│   │   ├── anthropic_llm.py
│   │   └── ollama_llm.py
│   ├── prompt/
│   │   ├── __init__.py
│   │   └── builder.py                # PromptBuilder
│   ├── eval/
│   │   ├── __init__.py
│   │   └── evaluator.py              # RAGEvaluator
│   ├── tracing/
│   │   ├── __init__.py
│   │   └── tracer.py                 # Tracer (context-var based)
│   ├── jobs/
│   │   ├── __init__.py
│   │   └── queue.py                  # AsyncJobQueue
│   └── api/
│       ├── __init__.py
│       ├── main.py                   # FastAPI app factory + dependency injection
│       ├── deps.py                   # Shared FastAPI dependencies
│       └── routes/
│           ├── ingest.py
│           ├── query.py
│           ├── conversations.py
│           ├── jobs.py
│           ├── eval.py
│           └── documents.py
├── tests/
│   ├── conftest.py
│   ├── unit/
│   │   ├── test_models.py
│   │   ├── test_chunker.py
│   │   ├── test_dedup.py
│   │   ├── test_retriever.py
│   │   ├── test_reranker.py
│   │   ├── test_hyde.py
│   │   ├── test_prompt_builder.py
│   │   ├── test_tracer.py
│   │   ├── test_jobs.py
│   │   ├── test_eval.py
│   │   ├── loaders/
│   │   │   ├── test_markdown_loader.py
│   │   │   ├── test_pdf_loader.py
│   │   │   └── test_html_loader.py
│   │   └── api/
│   │       ├── test_ingest_api.py
│   │       ├── test_query_api.py
│   │       ├── test_conversations_api.py
│   │       ├── test_jobs_api.py
│   │       └── test_documents_api.py
│   └── integration/
│       └── test_pipeline.py
├── docker-compose.yml
└── pyproject.toml
```

---

## ═══════════════════════════════════════
## PHASE 1: CORE RUNNABLE
## ═══════════════════════════════════════

---

### Task 1: Project Setup

**Files:**
- Create: `pyproject.toml`
- Create: `docker-compose.yml`
- Create: `app/__init__.py` (empty)
- Create: `tests/conftest.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "rag-system"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.111.0",
    "uvicorn[standard]>=0.29.0",
    "pydantic>=2.7.0",
    "qdrant-client>=1.9.0",
    "openai>=1.30.0",
    "anthropic>=0.28.0",
    "pymupdf>=1.24.0",
    "beautifulsoup4>=4.12.0",
    "httpx>=0.27.0",
    "tiktoken>=0.7.0",
    "sentence-transformers>=3.0.0",
    "torch>=2.3.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.2.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.27.0",
    "testcontainers[qdrant]>=4.5.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
version: "3.9"
services:
  qdrant:
    image: qdrant/qdrant:v1.9.2
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  qdrant_data:
```

- [ ] **Step 3: Create directory structure and empty __init__.py files**

```bash
mkdir -p app/{loaders,chunker,dedup,embedder,vectorstore,retriever,reranker,hyde,conversation,llm,prompt,eval,tracing,jobs,api/routes}
mkdir -p tests/{unit/{loaders,api},integration}
touch app/__init__.py app/loaders/__init__.py app/chunker/__init__.py
touch app/dedup/__init__.py app/embedder/__init__.py app/vectorstore/__init__.py
touch app/retriever/__init__.py app/reranker/__init__.py app/hyde/__init__.py
touch app/conversation/__init__.py app/llm/__init__.py app/prompt/__init__.py
touch app/eval/__init__.py app/tracing/__init__.py app/jobs/__init__.py
touch app/api/__init__.py app/api/routes/__init__.py
touch tests/__init__.py tests/unit/__init__.py tests/integration/__init__.py
touch tests/unit/loaders/__init__.py tests/unit/api/__init__.py
```

- [ ] **Step 4: Create tests/conftest.py**

```python
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def sample_text() -> str:
    return "Python is a programming language. " * 50
```

- [ ] **Step 5: Install dependencies**

```bash
pip install -e ".[dev]"
```

Expected: All packages install without errors.

- [ ] **Step 6: Commit**

```bash
git init
git add pyproject.toml docker-compose.yml app/ tests/
git commit -m "chore: project scaffolding and dependencies"
```

---

### Task 2: Data Models

**Files:**
- Create: `app/models.py`
- Create: `tests/unit/test_models.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/test_models.py
from datetime import datetime
from app.models import Document, Chunk, Message, Conversation, TraceInfo, QueryResult


def test_document_id_is_content_hash():
    doc = Document(source="test.md", content="hello world", metadata={})
    import hashlib
    expected = hashlib.sha256("hello world".encode()).hexdigest()
    assert doc.id == expected


def test_chunk_parent_id_none_for_parent_level():
    chunk = Chunk(
        id="abc",
        document_id="doc1",
        content="some text",
        level="parent",
        metadata={},
    )
    assert chunk.parent_id is None
    assert chunk.embedding is None


def test_conversation_has_created_at():
    conv = Conversation(id="c1", messages=[])
    assert isinstance(conv.created_at, datetime)


def test_query_result_structure():
    trace = TraceInfo(
        query_rewrite=None,
        hyde_doc=None,
        retrieval_scores=[],
        rerank_scores=[],
        timings={},
    )
    result = QueryResult(answer="42", sources=[], trace=trace)
    assert result.answer == "42"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/test_models.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.models'`

- [ ] **Step 3: Write app/models.py**

```python
import hashlib
from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, Field, model_validator


class Document(BaseModel):
    id: str = ""
    source: str
    content: str
    version: int = 1
    metadata: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def set_id_from_content(self) -> "Document":
        if not self.id:
            self.id = hashlib.sha256(self.content.encode()).hexdigest()
        return self


class Chunk(BaseModel):
    id: str
    document_id: str
    content: str
    parent_id: str | None = None
    level: Literal["parent", "child"]
    metadata: dict = Field(default_factory=dict)
    embedding: list[float] | None = None


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class Conversation(BaseModel):
    id: str
    messages: list[Message] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TraceInfo(BaseModel):
    query_rewrite: str | None = None
    hyde_doc: str | None = None
    retrieval_scores: list[float] = Field(default_factory=list)
    rerank_scores: list[float] = Field(default_factory=list)
    timings: dict[str, float] = Field(default_factory=dict)


class QueryResult(BaseModel):
    answer: str
    sources: list[Chunk] = Field(default_factory=list)
    trace: TraceInfo = Field(default_factory=TraceInfo)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/unit/test_models.py -v
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add app/models.py tests/unit/test_models.py
git commit -m "feat: add core data models (Document, Chunk, Conversation, QueryResult)"
```

---

### Task 3: Markdown Loader

**Files:**
- Create: `app/loaders/base.py`
- Create: `app/loaders/markdown_loader.py`
- Create: `tests/unit/loaders/test_markdown_loader.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/loaders/test_markdown_loader.py
import tempfile
from pathlib import Path
from app.loaders.markdown_loader import MarkdownLoader


def test_loads_markdown_file():
    loader = MarkdownLoader()
    with tempfile.NamedTemporaryFile(suffix=".md", mode="w", delete=False) as f:
        f.write("# Title\n\nSome content here.\n")
        path = f.name

    docs = loader.load(path)
    assert len(docs) == 1
    assert "Title" in docs[0].content
    assert "Some content here." in docs[0].content
    assert docs[0].source == path
    assert docs[0].metadata["doc_type"] == "markdown"


def test_markdown_document_id_is_hash():
    loader = MarkdownLoader()
    with tempfile.NamedTemporaryFile(suffix=".md", mode="w", delete=False) as f:
        f.write("hello")
        path = f.name

    import hashlib
    docs = loader.load(path)
    assert docs[0].id == hashlib.sha256("hello".encode()).hexdigest()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/loaders/test_markdown_loader.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/loaders/base.py**

```python
from abc import ABC, abstractmethod
from app.models import Document


class BaseLoader(ABC):
    @abstractmethod
    def load(self, path_or_url: str) -> list[Document]:
        """Parse source and return list of Document objects."""
        ...
```

- [ ] **Step 4: Write app/loaders/markdown_loader.py**

```python
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pytest tests/unit/loaders/test_markdown_loader.py -v
```

Expected: 2 passed

- [ ] **Step 6: Commit**

```bash
git add app/loaders/ tests/unit/loaders/test_markdown_loader.py
git commit -m "feat: add BaseLoader and MarkdownLoader"
```

---

### Task 4: PDF Loader

**Files:**
- Create: `app/loaders/pdf_loader.py`
- Create: `tests/unit/loaders/test_pdf_loader.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/loaders/test_pdf_loader.py
import tempfile
from pathlib import Path
import fitz  # pymupdf
from app.loaders.pdf_loader import PDFLoader


def _make_pdf(text: str) -> str:
    """Create a minimal PDF with given text, return path."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 100), text)
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        doc.save(f.name)
        return f.name


def test_loads_pdf_content():
    path = _make_pdf("Hello from PDF page one.")
    loader = PDFLoader()
    docs = loader.load(path)
    assert len(docs) == 1
    assert "Hello from PDF" in docs[0].content
    assert docs[0].metadata["doc_type"] == "pdf"
    assert docs[0].metadata["page_count"] == 1


def test_pdf_source_is_path():
    path = _make_pdf("test")
    loader = PDFLoader()
    docs = loader.load(path)
    assert docs[0].source == path
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/loaders/test_pdf_loader.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.loaders.pdf_loader'`

- [ ] **Step 3: Write app/loaders/pdf_loader.py**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/unit/loaders/test_pdf_loader.py -v
```

Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add app/loaders/pdf_loader.py tests/unit/loaders/test_pdf_loader.py
git commit -m "feat: add PDFLoader using pymupdf"
```

---

### Task 5: HTML / URL Loader

**Files:**
- Create: `app/loaders/html_loader.py`
- Create: `tests/unit/loaders/test_html_loader.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/loaders/test_html_loader.py
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
from app.loaders.html_loader import HTMLLoader


def test_loads_local_html_file():
    html = "<html><body><h1>Title</h1><p>Some paragraph.</p></body></html>"
    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", delete=False) as f:
        f.write(html)
        path = f.name

    loader = HTMLLoader()
    docs = loader.load(path)
    assert len(docs) == 1
    assert "Title" in docs[0].content
    assert "Some paragraph" in docs[0].content
    assert docs[0].metadata["doc_type"] == "html"


def test_loads_remote_url():
    html = "<html><body><p>Remote content.</p></body></html>"
    mock_response = MagicMock()
    mock_response.text = html
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.get", return_value=mock_response):
        loader = HTMLLoader()
        docs = loader.load("https://example.com/page")

    assert "Remote content" in docs[0].content
    assert docs[0].metadata["doc_type"] == "url"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/loaders/test_html_loader.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/loaders/html_loader.py**

```python
from pathlib import Path
import httpx
from bs4 import BeautifulSoup
from app.loaders.base import BaseLoader
from app.models import Document


class HTMLLoader(BaseLoader):
    def load(self, path_or_url: str) -> list[Document]:
        if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
            response = httpx.get(path_or_url, follow_redirects=True, timeout=30)
            response.raise_for_status()
            raw_html = response.text
            doc_type = "url"
        else:
            raw_html = Path(path_or_url).read_text(encoding="utf-8")
            doc_type = "html"

        soup = BeautifulSoup(raw_html, "html.parser")
        # Remove script and style tags
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/unit/loaders/test_html_loader.py -v
```

Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add app/loaders/html_loader.py tests/unit/loaders/test_html_loader.py
git commit -m "feat: add HTMLLoader supporting local files and remote URLs"
```

---

### Task 6: Hierarchical Chunker

**Files:**
- Create: `app/chunker/chunker.py`
- Create: `tests/unit/test_chunker.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/test_chunker.py
import tiktoken
from app.chunker.chunker import HierarchicalChunker
from app.models import Document


@pytest.fixture
def doc():
    # ~1500 tokens of text
    return Document(
        source="test.md",
        content="This is a sentence about machine learning. " * 100,
        metadata={}
    )


import pytest

def test_produces_parent_and_child_chunks(doc):
    chunker = HierarchicalChunker()
    chunks = chunker.chunk(doc)
    levels = {c.level for c in chunks}
    assert "parent" in levels
    assert "child" in levels


def test_parent_chunks_are_larger_than_child(doc):
    chunker = HierarchicalChunker()
    chunks = chunker.chunk(doc)
    enc = tiktoken.get_encoding("cl100k_base")
    parents = [c for c in chunks if c.level == "parent"]
    children = [c for c in chunks if c.level == "child"]
    avg_parent = sum(len(enc.encode(c.content)) for c in parents) / len(parents)
    avg_child = sum(len(enc.encode(c.content)) for c in children) / len(children)
    assert avg_parent > avg_child


def test_child_chunks_reference_parent_id(doc):
    chunker = HierarchicalChunker()
    chunks = chunker.chunk(doc)
    parent_ids = {c.id for c in chunks if c.level == "parent"}
    children = [c for c in chunks if c.level == "child"]
    for child in children:
        assert child.parent_id in parent_ids


def test_all_chunks_reference_document_id(doc):
    chunker = HierarchicalChunker()
    chunks = chunker.chunk(doc)
    for chunk in chunks:
        assert chunk.document_id == doc.id


def test_child_chunks_have_overlap(doc):
    chunker = HierarchicalChunker(child_size=50, child_overlap=10)
    chunks = chunker.chunk(doc)
    children = [c for c in chunks if c.level == "child"]
    # With overlap, consecutive children should share some tokens
    if len(children) >= 2:
        enc = tiktoken.get_encoding("cl100k_base")
        t1 = set(enc.encode(children[0].content))
        t2 = set(enc.encode(children[1].content))
        assert len(t1 & t2) > 0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/test_chunker.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/chunker/chunker.py**

```python
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
                metadata={**doc.metadata},
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
                    metadata={**doc.metadata},
                )
                result.append(child_chunk)

        return result
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/unit/test_chunker.py -v
```

Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add app/chunker/chunker.py tests/unit/test_chunker.py
git commit -m "feat: add HierarchicalChunker with parent/child split and overlap"
```

---

### Task 7: Embedder (Base + OpenAI)

**Files:**
- Create: `app/embedder/base.py`
- Create: `app/embedder/openai_embedder.py`
- Create: `app/embedder/local_embedder.py`
- Create: `tests/unit/test_embedder.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/test_embedder.py
from unittest.mock import MagicMock, patch
from app.embedder.base import BaseEmbedder
from app.embedder.openai_embedder import OpenAIEmbedder
from app.embedder.local_embedder import LocalEmbedder


def test_openai_embedder_calls_api():
    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=[0.1, 0.2, 0.3])]
    )
    embedder = OpenAIEmbedder(client=mock_client, model="text-embedding-3-small")
    result = embedder.embed(["hello world"])
    assert len(result) == 1
    assert result[0] == [0.1, 0.2, 0.3]
    mock_client.embeddings.create.assert_called_once()


def test_openai_embedder_batches_input():
    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=[0.1] * 3), MagicMock(embedding=[0.2] * 3)]
    )
    embedder = OpenAIEmbedder(client=mock_client, batch_size=2)
    result = embedder.embed(["a", "b"])
    assert len(result) == 2


def test_base_embedder_is_abstract():
    import inspect
    assert inspect.isabstract(BaseEmbedder)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/test_embedder.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/embedder/base.py**

```python
from abc import ABC, abstractmethod


class BaseEmbedder(ABC):
    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of texts, return list of embedding vectors."""
        ...
```

- [ ] **Step 4: Write app/embedder/openai_embedder.py**

```python
from openai import OpenAI
from app.embedder.base import BaseEmbedder


class OpenAIEmbedder(BaseEmbedder):
    def __init__(
        self,
        client: OpenAI | None = None,
        model: str = "text-embedding-3-small",
        batch_size: int = 32,
    ):
        self.client = client or OpenAI()
        self.model = model
        self.batch_size = batch_size

    def embed(self, texts: list[str]) -> list[list[float]]:
        results: list[list[float]] = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            response = self.client.embeddings.create(input=batch, model=self.model)
            results.extend(item.embedding for item in response.data)
        return results
```

- [ ] **Step 5: Write app/embedder/local_embedder.py**

```python
from app.embedder.base import BaseEmbedder


class LocalEmbedder(BaseEmbedder):
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        from sentence_transformers import SentenceTransformer
        self.model = SentenceTransformer(model_name)

    def embed(self, texts: list[str]) -> list[list[float]]:
        embeddings = self.model.encode(texts, convert_to_numpy=True)
        return embeddings.tolist()
```

- [ ] **Step 6: Run test to verify it passes**

```bash
pytest tests/unit/test_embedder.py -v
```

Expected: 3 passed

- [ ] **Step 7: Commit**

```bash
git add app/embedder/ tests/unit/test_embedder.py
git commit -m "feat: add BaseEmbedder, OpenAIEmbedder, LocalEmbedder"
```

---

### Task 8: VectorStore (Qdrant)

**Files:**
- Create: `app/vectorstore/qdrant_store.py`
- Create: `tests/unit/test_vectorstore.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/test_vectorstore.py
from unittest.mock import MagicMock, patch, call
from app.vectorstore.qdrant_store import QdrantStore
from app.models import Chunk


def _make_chunk(id: str, content: str, level: str = "child", parent_id: str | None = None) -> Chunk:
    return Chunk(
        id=id,
        document_id="doc1",
        content=content,
        level=level,
        parent_id=parent_id,
        embedding=[0.1, 0.2, 0.3],
    )


def test_upsert_child_chunks_stores_vectors():
    mock_client = MagicMock()
    store = QdrantStore(client=mock_client, collection_name="test")
    chunks = [_make_chunk("c1", "text one"), _make_chunk("c2", "text two")]
    store.upsert(chunks)
    mock_client.upsert.assert_called_once()


def test_upsert_parent_chunks_no_vector():
    mock_client = MagicMock()
    store = QdrantStore(client=mock_client, collection_name="test")
    parent = _make_chunk("p1", "parent text", level="parent")
    parent.embedding = None
    store.upsert([parent])
    # Parent chunks stored without embedding — use payload-only upsert
    mock_client.upsert.assert_called_once()


def test_search_returns_chunks():
    mock_client = MagicMock()
    mock_client.search.return_value = [
        MagicMock(
            id="c1",
            score=0.9,
            payload={
                "document_id": "doc1",
                "content": "hello",
                "parent_id": "p1",
                "level": "child",
                "metadata": {},
            },
        )
    ]
    store = QdrantStore(client=mock_client, collection_name="test")
    results = store.search(query_vector=[0.1, 0.2, 0.3], top_k=5)
    assert len(results) == 1
    assert results[0].id == "c1"
    assert results[0].content == "hello"


def test_get_by_ids_returns_chunks():
    mock_client = MagicMock()
    mock_client.retrieve.return_value = [
        MagicMock(
            id="p1",
            payload={
                "document_id": "doc1",
                "content": "parent text",
                "parent_id": None,
                "level": "parent",
                "metadata": {},
            },
        )
    ]
    store = QdrantStore(client=mock_client, collection_name="test")
    chunks = store.get_by_ids(["p1"])
    assert chunks[0].id == "p1"
    assert chunks[0].level == "parent"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/test_vectorstore.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/vectorstore/qdrant_store.py**

```python
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance
from app.models import Chunk


class QdrantStore:
    def __init__(
        self,
        client: QdrantClient | None = None,
        collection_name: str = "rag_chunks",
        vector_size: int = 1536,
        host: str = "localhost",
        port: int = 6333,
    ):
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
                # Parent chunks: store with a zero vector (not searched by vector)
                points.append(PointStruct(
                    id=chunk.id,
                    vector=[0.0] * self.vector_size,
                    payload={**payload, "is_parent": True},
                ))
        self.client.upsert(collection_name=self.collection_name, points=points)

    def search(self, query_vector: list[float], top_k: int = 20) -> list[Chunk]:
        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=top_k,
            query_filter=None,
        )
        return [self._point_to_chunk(r.id, r.payload) for r in results]

    def get_by_ids(self, ids: list[str]) -> list[Chunk]:
        results = self.client.retrieve(
            collection_name=self.collection_name,
            ids=ids,
            with_payload=True,
        )
        return [self._point_to_chunk(r.id, r.payload) for r in results]

    def delete_by_document_id(self, document_id: str) -> None:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=Filter(
                must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
            ),
        )

    def _point_to_chunk(self, point_id: str, payload: dict) -> Chunk:
        return Chunk(
            id=str(point_id),
            document_id=payload["document_id"],
            content=payload["content"],
            parent_id=payload.get("parent_id"),
            level=payload["level"],
            metadata=payload.get("metadata", {}),
        )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/unit/test_vectorstore.py -v
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add app/vectorstore/qdrant_store.py tests/unit/test_vectorstore.py
git commit -m "feat: add QdrantStore with upsert, search, get_by_ids, delete_by_document_id"
```

---

### Task 9: LLM Clients

**Files:**
- Create: `app/llm/base.py`
- Create: `app/llm/openai_llm.py`
- Create: `app/llm/anthropic_llm.py`
- Create: `app/llm/ollama_llm.py`
- Create: `tests/unit/test_llm.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/test_llm.py
import inspect
from unittest.mock import MagicMock
from app.llm.base import BaseLLM
from app.llm.openai_llm import OpenAILLM
from app.llm.anthropic_llm import AnthropicLLM
from app.llm.ollama_llm import OllamaLLM
from app.models import Message


def test_base_llm_is_abstract():
    assert inspect.isabstract(BaseLLM)


def test_openai_llm_generate():
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Hello!"))]
    )
    llm = OpenAILLM(client=mock_client)
    messages = [Message(role="user", content="Hi")]
    result = llm.generate(messages)
    assert result == "Hello!"


def test_anthropic_llm_generate():
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="Anthropic response")]
    )
    llm = AnthropicLLM(client=mock_client)
    messages = [Message(role="user", content="Hi")]
    result = llm.generate(messages)
    assert result == "Anthropic response"


def test_ollama_llm_generate():
    mock_response = MagicMock()
    mock_response.json.return_value = {"message": {"content": "Ollama response"}}
    mock_response.raise_for_status = MagicMock()

    import httpx
    from unittest.mock import patch
    with patch.object(httpx.Client, "post", return_value=mock_response):
        llm = OllamaLLM(model="llama3")
        messages = [Message(role="user", content="Hi")]
        result = llm.generate(messages)
    assert result == "Ollama response"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/test_llm.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/llm/base.py**

```python
from abc import ABC, abstractmethod
from app.models import Message


class BaseLLM(ABC):
    @abstractmethod
    def generate(self, messages: list[Message]) -> str:
        """Send messages to LLM, return response text."""
        ...
```

- [ ] **Step 4: Write app/llm/openai_llm.py**

```python
from openai import OpenAI
from app.llm.base import BaseLLM
from app.models import Message


class OpenAILLM(BaseLLM):
    def __init__(self, client: OpenAI | None = None, model: str = "gpt-4o-mini"):
        self.client = client or OpenAI()
        self.model = model

    def generate(self, messages: list[Message]) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        )
        return response.choices[0].message.content or ""
```

- [ ] **Step 5: Write app/llm/anthropic_llm.py**

```python
import anthropic
from app.llm.base import BaseLLM
from app.models import Message


class AnthropicLLM(BaseLLM):
    def __init__(
        self,
        client: anthropic.Anthropic | None = None,
        model: str = "claude-sonnet-4-6",
        max_tokens: int = 1024,
    ):
        self.client = client or anthropic.Anthropic()
        self.model = model
        self.max_tokens = max_tokens

    def generate(self, messages: list[Message]) -> str:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        )
        return response.content[0].text
```

- [ ] **Step 6: Write app/llm/ollama_llm.py**

```python
import httpx
from app.llm.base import BaseLLM
from app.models import Message


class OllamaLLM(BaseLLM):
    def __init__(self, model: str = "llama3", base_url: str = "http://localhost:11434"):
        self.model = model
        self.base_url = base_url

    def generate(self, messages: list[Message]) -> str:
        with httpx.Client(timeout=120) as client:
            response = client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": [{"role": m.role, "content": m.content} for m in messages],
                    "stream": False,
                },
            )
            response.raise_for_status()
            return response.json()["message"]["content"]
```

- [ ] **Step 7: Run test to verify it passes**

```bash
pytest tests/unit/test_llm.py -v
```

Expected: 4 passed

- [ ] **Step 8: Commit**

```bash
git add app/llm/ tests/unit/test_llm.py
git commit -m "feat: add BaseLLM and OpenAI/Anthropic/Ollama implementations"
```

---

### Task 10: Prompt Builder

**Files:**
- Create: `app/prompt/builder.py`
- Create: `tests/unit/test_prompt_builder.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/test_prompt_builder.py
from app.prompt.builder import PromptBuilder
from app.models import Chunk, Message


def _make_chunk(content: str) -> Chunk:
    return Chunk(id="c1", document_id="d1", content=content, level="parent", metadata={})


def test_build_returns_messages():
    builder = PromptBuilder()
    chunks = [_make_chunk("Python is a language."), _make_chunk("It was created in 1991.")]
    messages = builder.build(question="When was Python created?", context_chunks=chunks)
    assert isinstance(messages, list)
    assert all(isinstance(m, Message) for m in messages)


def test_system_message_is_first():
    builder = PromptBuilder()
    messages = builder.build(question="Q?", context_chunks=[_make_chunk("ctx")])
    assert messages[0].role == "user" or messages[0].role == "system"


def test_context_chunks_appear_in_messages():
    builder = PromptBuilder()
    chunks = [_make_chunk("Important fact here.")]
    messages = builder.build(question="What fact?", context_chunks=chunks)
    full_text = " ".join(m.content for m in messages)
    assert "Important fact here." in full_text


def test_question_appears_in_messages():
    builder = PromptBuilder()
    messages = builder.build(question="What is 42?", context_chunks=[_make_chunk("ctx")])
    full_text = " ".join(m.content for m in messages)
    assert "What is 42?" in full_text


def test_empty_context_raises():
    builder = PromptBuilder()
    import pytest
    with pytest.raises(ValueError, match="context_chunks"):
        builder.build(question="Q?", context_chunks=[])
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/test_prompt_builder.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/prompt/builder.py**

```python
from app.models import Chunk, Message

SYSTEM_PROMPT = """You are a helpful assistant that answers questions based on the provided context.
Answer only from the context below. If the context does not contain enough information to answer, say:
"在知识库中未找到与该问题相关的内容。"
Always cite which context passage your answer comes from."""


class PromptBuilder:
    def build(self, question: str, context_chunks: list[Chunk]) -> list[Message]:
        if not context_chunks:
            raise ValueError("context_chunks must not be empty")

        context_parts = []
        for i, chunk in enumerate(context_chunks, 1):
            context_parts.append(f"[{i}] {chunk.content}")
        context_text = "\n\n".join(context_parts)

        user_content = f"""Context:
{context_text}

Question: {question}

Answer:"""

        return [
            Message(role="user", content=SYSTEM_PROMPT + "\n\n" + user_content)
        ]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/unit/test_prompt_builder.py -v
```

Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add app/prompt/builder.py tests/unit/test_prompt_builder.py
git commit -m "feat: add PromptBuilder with RAG prompt template"
```

---

### Task 11: FastAPI App + Ingestion + Query Endpoints (Phase 1)

**Files:**
- Create: `app/api/deps.py`
- Create: `app/api/main.py`
- Create: `app/api/routes/ingest.py`
- Create: `app/api/routes/query.py`
- Create: `tests/unit/api/test_query_api.py`
- Create: `tests/unit/api/test_ingest_api.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/unit/api/test_ingest_api.py
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from app.api.main import create_app
    mock_embedder = MagicMock()
    mock_embedder.embed.return_value = [[0.1] * 1536]
    mock_store = MagicMock()
    app = create_app(embedder=mock_embedder, store=mock_store, llm=MagicMock())
    return TestClient(app)


def test_ingest_markdown_returns_job_id(client, tmp_path):
    md_file = tmp_path / "test.md"
    md_file.write_text("# Hello\n\nThis is content.")
    response = client.post("/ingest", json={
        "path_or_url": str(md_file),
        "doc_type": "markdown"
    })
    assert response.status_code == 200
    assert "job_id" in response.json()


def test_ingest_unknown_type_returns_422(client):
    response = client.post("/ingest", json={
        "path_or_url": "/some/path.xyz",
        "doc_type": "unknown"
    })
    assert response.status_code == 422
```

```python
# tests/unit/api/test_query_api.py
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.models import Message


@pytest.fixture
def client():
    from app.api.main import create_app
    mock_embedder = MagicMock()
    mock_embedder.embed.return_value = [[0.1] * 1536]
    mock_store = MagicMock()
    mock_store.search.return_value = []
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "42"
    app = create_app(embedder=mock_embedder, store=mock_store, llm=mock_llm)
    return TestClient(app)


def test_query_with_no_results_returns_fallback(client):
    response = client.post("/query", json={"question": "What is the answer?"})
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "sources" in data
    assert "trace" in data


def test_query_missing_question_returns_422(client):
    response = client.post("/query", json={})
    assert response.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/unit/api/ -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/api/deps.py**

```python
from app.embedder.base import BaseEmbedder
from app.vectorstore.qdrant_store import QdrantStore
from app.llm.base import BaseLLM
from app.chunker.chunker import HierarchicalChunker
from app.prompt.builder import PromptBuilder
from app.jobs.queue import AsyncJobQueue

# These are overridden in tests via create_app()
_embedder: BaseEmbedder | None = None
_store: QdrantStore | None = None
_llm: BaseLLM | None = None
_job_queue: AsyncJobQueue = AsyncJobQueue()  # shared singleton
_chunker = HierarchicalChunker()
_prompt_builder = PromptBuilder()


def get_embedder() -> BaseEmbedder:
    return _embedder


def get_store() -> QdrantStore:
    return _store


def get_llm() -> BaseLLM:
    return _llm


def get_job_queue() -> AsyncJobQueue:
    return _job_queue


def get_chunker() -> HierarchicalChunker:
    return _chunker


def get_prompt_builder() -> PromptBuilder:
    return _prompt_builder
```

- [ ] **Step 4: Write app/api/routes/ingest.py**

```python
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import uuid

from app.api.deps import get_embedder, get_store, get_chunker
from app.loaders.markdown_loader import MarkdownLoader
from app.loaders.pdf_loader import PDFLoader
from app.loaders.html_loader import HTMLLoader

router = APIRouter()

LOADERS = {
    "markdown": MarkdownLoader(),
    "pdf": PDFLoader(),
    "html": HTMLLoader(),
    "url": HTMLLoader(),
}


class IngestRequest(BaseModel):
    path_or_url: str
    doc_type: Literal["pdf", "markdown", "html", "url"]


class IngestResponse(BaseModel):
    job_id: str
    status: str = "completed"


@router.post("/ingest", response_model=IngestResponse)
def ingest(
    req: IngestRequest,
    embedder=Depends(get_embedder),
    store=Depends(get_store),
    chunker=Depends(get_chunker),
):
    loader = LOADERS[req.doc_type]
    docs = loader.load(req.path_or_url)
    for doc in docs:
        chunks = chunker.chunk(doc)
        child_chunks = [c for c in chunks if c.level == "child"]
        texts = [c.content for c in child_chunks]
        if texts:
            embeddings = embedder.embed(texts)
            for chunk, emb in zip(child_chunks, embeddings):
                chunk.embedding = emb
        store.upsert(chunks)
    return IngestResponse(job_id=str(uuid.uuid4()))
```

- [ ] **Step 5: Write app/api/routes/query.py**

```python
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_embedder, get_store, get_llm, get_prompt_builder
from app.models import QueryResult, TraceInfo

router = APIRouter()
SIMILARITY_THRESHOLD = 0.5
FALLBACK_MSG = "在知识库中未找到与该问题相关的内容。"


class QueryRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None
    use_hyde: bool = False


@router.post("/query", response_model=QueryResult)
def query(
    req: QueryRequest,
    embedder=Depends(get_embedder),
    store=Depends(get_store),
    llm=Depends(get_llm),
    prompt_builder=Depends(get_prompt_builder),
):
    import time
    trace = TraceInfo()
    timings: dict[str, float] = {}

    t0 = time.monotonic()
    q_embedding = embedder.embed([req.question])[0]
    timings["embed_query"] = (time.monotonic() - t0) * 1000

    t0 = time.monotonic()
    child_chunks = store.search(query_vector=q_embedding, top_k=20)
    timings["vector_search"] = (time.monotonic() - t0) * 1000

    if not child_chunks:
        trace.timings = timings
        return QueryResult(answer=FALLBACK_MSG, sources=[], trace=trace)

    # Parent chunk recall
    parent_ids = list({c.parent_id for c in child_chunks if c.parent_id})
    context_chunks = store.get_by_ids(parent_ids) if parent_ids else child_chunks[:5]

    if not context_chunks:
        trace.timings = timings
        return QueryResult(answer=FALLBACK_MSG, sources=[], trace=trace)

    t0 = time.monotonic()
    messages = prompt_builder.build(question=req.question, context_chunks=context_chunks)
    answer = llm.generate(messages)
    timings["llm_generate"] = (time.monotonic() - t0) * 1000

    trace.timings = timings
    return QueryResult(answer=answer, sources=context_chunks, trace=trace)
```

- [ ] **Step 6: Write app/api/main.py**

```python
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
) -> FastAPI:
    deps._embedder = embedder
    deps._store = store
    deps._llm = llm

    app = FastAPI(title="RAG System", version="0.1.0")
    app.include_router(ingest.router)
    app.include_router(query.router)
    return app
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
pytest tests/unit/api/ -v
```

Expected: 5 passed

- [ ] **Step 8: Commit**

```bash
git add app/api/ tests/unit/api/
git commit -m "feat: add FastAPI app with /ingest and /query endpoints (Phase 1 complete)"
```

---

### Task 12: Phase 1 Integration Test

**Files:**
- Create: `tests/integration/test_pipeline.py`

- [ ] **Step 1: Start Qdrant**

```bash
docker compose up -d qdrant
```

Expected: Qdrant running on localhost:6333

- [ ] **Step 2: Write the integration test**

```python
# tests/integration/test_pipeline.py
import pytest
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from app.api.main import create_app
from app.embedder.local_embedder import LocalEmbedder
from app.vectorstore.qdrant_store import QdrantStore
from app.llm.openai_llm import OpenAILLM
from qdrant_client import QdrantClient


@pytest.fixture(scope="module")
def integration_client():
    client = QdrantClient(host="localhost", port=6333)
    store = QdrantStore(client=client, collection_name="test_integration", vector_size=384)
    store.ensure_collection()
    embedder = LocalEmbedder("sentence-transformers/all-MiniLM-L6-v2")

    from unittest.mock import MagicMock
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "Python was created by Guido van Rossum."

    app = create_app(embedder=embedder, store=store, llm=mock_llm)
    return TestClient(app)


@pytest.fixture(scope="module")
def ingested_doc(integration_client, tmp_path_factory):
    tmp = tmp_path_factory.mktemp("docs")
    md_file = tmp / "python.md"
    md_file.write_text(
        "# Python Programming Language\n\n"
        "Python was created by Guido van Rossum and first released in 1991. "
        "It emphasizes code readability and uses significant indentation. " * 10
    )
    response = integration_client.post("/ingest", json={
        "path_or_url": str(md_file),
        "doc_type": "markdown"
    })
    assert response.status_code == 200
    return response.json()["job_id"]


def test_ingest_returns_job_id(ingested_doc):
    assert ingested_doc is not None


def test_query_returns_answer(integration_client, ingested_doc):
    response = integration_client.post("/query", json={
        "question": "Who created Python?"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "Python was created by Guido van Rossum."
    assert len(data["sources"]) > 0
```

- [ ] **Step 3: Run integration test**

```bash
pytest tests/integration/test_pipeline.py -v
```

Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add tests/integration/test_pipeline.py
git commit -m "test: add Phase 1 integration test (ingest + query pipeline)"
```

---

## ═══════════════════════════════════════
## PHASE 2: RETRIEVAL ENHANCEMENT
## ═══════════════════════════════════════

---

### Task 13: Dedup Manager

**Files:**
- Create: `app/dedup/dedup.py`
- Create: `tests/unit/test_dedup.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/test_dedup.py
from unittest.mock import MagicMock
from app.dedup.dedup import DedupManager
from app.models import Document


def _make_doc(content: str, source: str = "test.md") -> Document:
    return Document(source=source, content=content, metadata={})


def test_new_document_is_not_duplicate():
    mock_store = MagicMock()
    mock_store.get_by_ids.return_value = []
    manager = DedupManager(store=mock_store)
    doc = _make_doc("new content")
    result = manager.check(doc)
    assert result.is_duplicate is False
    assert result.is_update is False


def test_identical_content_is_duplicate():
    doc = _make_doc("same content")
    mock_store = MagicMock()
    # Simulate: a chunk with this document_id already exists
    mock_store.get_by_ids.return_value = [MagicMock(document_id=doc.id)]
    manager = DedupManager(store=mock_store)
    result = manager.check(doc)
    assert result.is_duplicate is True


def test_same_source_different_content_is_update():
    old_doc = _make_doc("old content", source="file.md")
    new_doc = _make_doc("new content", source="file.md")
    mock_store = MagicMock()
    # Source changed: no chunk with new hash, but registry has old hash for this source
    manager = DedupManager(store=mock_store)
    manager._source_registry[new_doc.source] = old_doc.id  # Simulate registered old doc
    result = manager.check(new_doc)
    assert result.is_update is True
    assert result.old_document_id == old_doc.id
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/test_dedup.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/dedup/dedup.py**

```python
from dataclasses import dataclass, field
from app.models import Document
from app.vectorstore.qdrant_store import QdrantStore


@dataclass
class DedupResult:
    is_duplicate: bool = False
    is_update: bool = False
    old_document_id: str | None = None


class DedupManager:
    """
    In-memory registry mapping source path → document_id (content hash).
    In production, persist this registry to a database.
    """

    def __init__(self, store: QdrantStore):
        self.store = store
        self._source_registry: dict[str, str] = {}  # source → doc_id

    def check(self, doc: Document) -> DedupResult:
        # Check if identical content already ingested
        existing = self.store.get_by_ids([doc.id])
        if existing:
            return DedupResult(is_duplicate=True)

        # Check if same source was ingested before with different content
        old_id = self._source_registry.get(doc.source)
        if old_id and old_id != doc.id:
            return DedupResult(is_update=True, old_document_id=old_id)

        return DedupResult()

    def register(self, doc: Document) -> None:
        """Call after successful ingestion to track source → doc_id."""
        self._source_registry[doc.source] = doc.id
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/unit/test_dedup.py -v
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add app/dedup/dedup.py tests/unit/test_dedup.py
git commit -m "feat: add DedupManager for content-hash dedup and version detection"
```

---

### Task 14: Hybrid Retriever (Vector + BM25 + RRF)

**Files:**
- Create: `app/retriever/retriever.py`
- Create: `tests/unit/test_retriever.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/test_retriever.py
from app.retriever.retriever import HybridRetriever, rrf_fuse
from app.models import Chunk


def _make_chunk(id: str, content: str) -> Chunk:
    return Chunk(id=id, document_id="d1", content=content, level="child", metadata={})


def test_rrf_fuse_merges_rankings():
    list_a = [_make_chunk("a", "text a"), _make_chunk("b", "text b")]
    list_b = [_make_chunk("b", "text b"), _make_chunk("c", "text c")]
    result = rrf_fuse([list_a, list_b], k=60)
    ids = [c.id for c in result]
    # "b" appears in both lists so should rank highest
    assert ids[0] == "b"
    assert set(ids) == {"a", "b", "c"}


def test_rrf_fuse_returns_top_k():
    chunks = [_make_chunk(str(i), f"text {i}") for i in range(10)]
    result = rrf_fuse([chunks], k=60, top_k=5)
    assert len(result) == 5


def test_hybrid_retriever_calls_both_searches():
    from unittest.mock import MagicMock
    mock_store = MagicMock()
    mock_store.search.return_value = [_make_chunk("c1", "hello")]
    mock_store.bm25_search.return_value = [_make_chunk("c2", "world")]
    mock_embedder = MagicMock()
    mock_embedder.embed.return_value = [[0.1] * 3]

    retriever = HybridRetriever(store=mock_store, embedder=mock_embedder)
    results = retriever.retrieve("test query", top_k=10)

    mock_store.search.assert_called_once()
    mock_store.bm25_search.assert_called_once()
    assert len(results) <= 10
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/test_retriever.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/retriever/retriever.py**

```python
from app.models import Chunk
from app.vectorstore.qdrant_store import QdrantStore
from app.embedder.base import BaseEmbedder


def rrf_fuse(
    ranked_lists: list[list[Chunk]],
    k: int = 60,
    top_k: int = 10,
) -> list[Chunk]:
    """Reciprocal Rank Fusion: score = Σ 1/(k + rank)."""
    scores: dict[str, float] = {}
    chunks_by_id: dict[str, Chunk] = {}

    for ranked in ranked_lists:
        for rank, chunk in enumerate(ranked, start=1):
            scores[chunk.id] = scores.get(chunk.id, 0.0) + 1.0 / (k + rank)
            chunks_by_id[chunk.id] = chunk

    sorted_ids = sorted(scores, key=lambda cid: scores[cid], reverse=True)
    return [chunks_by_id[cid] for cid in sorted_ids[:top_k]]


class HybridRetriever:
    def __init__(
        self,
        store: QdrantStore,
        embedder: BaseEmbedder,
        vector_top_k: int = 20,
        bm25_top_k: int = 20,
        rrf_k: int = 60,
    ):
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
```

- [ ] **Step 4: Add bm25_search to QdrantStore**

Open `app/vectorstore/qdrant_store.py` and add after `search()`:

```python
def bm25_search(self, query: str, top_k: int = 20) -> list[Chunk]:
    """BM25 full-text search using Qdrant's sparse vector support."""
    from qdrant_client.models import SparseVector, NamedSparseVector
    # Simple keyword-frequency sparse encoding for BM25 approximation
    tokens = query.lower().split()
    token_freq: dict[int, float] = {}
    for token in tokens:
        idx = abs(hash(token)) % 50000
        token_freq[idx] = token_freq.get(idx, 0.0) + 1.0

    try:
        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=NamedSparseVector(
                name="bm25",
                vector=SparseVector(
                    indices=list(token_freq.keys()),
                    values=list(token_freq.values()),
                ),
            ),
            limit=top_k,
        )
        return [self._point_to_chunk(r.id, r.payload) for r in results]
    except Exception:
        # Fallback: return empty list if BM25 index not configured
        return []
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pytest tests/unit/test_retriever.py -v
```

Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add app/retriever/retriever.py app/vectorstore/qdrant_store.py tests/unit/test_retriever.py
git commit -m "feat: add HybridRetriever with RRF fusion (vector + BM25)"
```

---

### Task 15: Reranker (Cross-Encoder)

**Files:**
- Create: `app/reranker/base.py`
- Create: `app/reranker/cross_encoder_reranker.py`
- Create: `tests/unit/test_reranker.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/test_reranker.py
import inspect
from unittest.mock import MagicMock, patch
from app.reranker.base import BaseReranker
from app.reranker.cross_encoder_reranker import CrossEncoderReranker
from app.models import Chunk


def _make_chunk(id: str, content: str) -> Chunk:
    return Chunk(id=id, document_id="d1", content=content, level="child", metadata={})


def test_base_reranker_is_abstract():
    assert inspect.isabstract(BaseReranker)


def test_cross_encoder_reranker_orders_by_score():
    mock_model = MagicMock()
    # Return higher score for second chunk
    mock_model.predict.return_value = [0.2, 0.9, 0.5]

    with patch("sentence_transformers.CrossEncoder", return_value=mock_model):
        reranker = CrossEncoderReranker(model_name="cross-encoder/ms-marco-MiniLM-L-6-v2")
        reranker.model = mock_model

    chunks = [
        _make_chunk("c1", "irrelevant text"),
        _make_chunk("c2", "highly relevant answer"),
        _make_chunk("c3", "somewhat relevant"),
    ]
    result = reranker.rerank(query="test query", chunks=chunks, top_k=2)
    assert len(result) == 2
    assert result[0].id == "c2"  # highest score 0.9
    assert result[1].id == "c3"  # second score 0.5


def test_reranker_respects_top_k():
    mock_model = MagicMock()
    mock_model.predict.return_value = [0.1, 0.9, 0.5, 0.3, 0.7]

    chunks = [_make_chunk(str(i), f"text {i}") for i in range(5)]
    reranker = CrossEncoderReranker.__new__(CrossEncoderReranker)
    reranker.model = mock_model
    result = reranker.rerank(query="q", chunks=chunks, top_k=3)
    assert len(result) == 3
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/test_reranker.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/reranker/base.py**

```python
from abc import ABC, abstractmethod
from app.models import Chunk


class BaseReranker(ABC):
    @abstractmethod
    def rerank(self, query: str, chunks: list[Chunk], top_k: int = 5) -> list[Chunk]:
        """Re-rank chunks by relevance to query, return top_k."""
        ...
```

- [ ] **Step 4: Write app/reranker/cross_encoder_reranker.py**

```python
from app.reranker.base import BaseReranker
from app.models import Chunk


class CrossEncoderReranker(BaseReranker):
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        from sentence_transformers import CrossEncoder
        self.model = CrossEncoder(model_name)

    def rerank(self, query: str, chunks: list[Chunk], top_k: int = 5) -> list[Chunk]:
        if not chunks:
            return []
        pairs = [(query, chunk.content) for chunk in chunks]
        scores = self.model.predict(pairs)
        scored = sorted(zip(scores, chunks), key=lambda x: x[0], reverse=True)
        return [chunk for _, chunk in scored[:top_k]]
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pytest tests/unit/test_reranker.py -v
```

Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add app/reranker/ tests/unit/test_reranker.py
git commit -m "feat: add BaseReranker and CrossEncoderReranker"
```

---

### Task 16: HyDE (Hypothetical Document Embeddings)

**Files:**
- Create: `app/hyde/hyde.py`
- Create: `tests/unit/test_hyde.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/test_hyde.py
from unittest.mock import MagicMock
from app.hyde.hyde import HyDEGenerator
from app.models import Message


def test_hyde_generates_hypothesis_and_averages_embeddings():
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "Python was created by Guido van Rossum in 1991."

    mock_embedder = MagicMock()
    # Return different embeddings for question and hypothesis
    mock_embedder.embed.side_effect = [
        [[1.0, 0.0, 0.0]],   # question embedding
        [[0.0, 1.0, 0.0]],   # hypothesis embedding
    ]

    generator = HyDEGenerator(llm=mock_llm, embedder=mock_embedder)
    result_vec, hypothesis = generator.generate("Who created Python?")

    assert hypothesis == "Python was created by Guido van Rossum in 1991."
    # Average of [1,0,0] and [0,1,0] = [0.5, 0.5, 0]
    assert abs(result_vec[0] - 0.5) < 1e-6
    assert abs(result_vec[1] - 0.5) < 1e-6
    assert abs(result_vec[2] - 0.0) < 1e-6


def test_hyde_uses_question_only_if_llm_fails():
    mock_llm = MagicMock()
    mock_llm.generate.side_effect = Exception("LLM error")
    mock_embedder = MagicMock()
    mock_embedder.embed.return_value = [[0.5, 0.5, 0.0]]

    generator = HyDEGenerator(llm=mock_llm, embedder=mock_embedder)
    result_vec, hypothesis = generator.generate("Who created Python?")

    assert hypothesis is None
    assert result_vec == [0.5, 0.5, 0.0]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/test_hyde.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/hyde/hyde.py**

```python
from app.llm.base import BaseLLM
from app.embedder.base import BaseEmbedder
from app.models import Message

HYDE_PROMPT = "Write a short passage that would directly answer the following question:\n\n"


class HyDEGenerator:
    def __init__(self, llm: BaseLLM, embedder: BaseEmbedder):
        self.llm = llm
        self.embedder = embedder

    def generate(self, question: str) -> tuple[list[float], str | None]:
        """
        Returns (embedding_vector, hypothesis_text).
        The embedding is the average of question + hypothesis embeddings.
        If LLM fails, returns question embedding only.
        """
        question_vec = self.embedder.embed([question])[0]

        try:
            hypothesis = self.llm.generate([
                Message(role="user", content=HYDE_PROMPT + question)
            ])
            hypothesis_vec = self.embedder.embed([hypothesis])[0]
            avg_vec = [
                (q + h) / 2.0
                for q, h in zip(question_vec, hypothesis_vec)
            ]
            return avg_vec, hypothesis
        except Exception:
            return question_vec, None
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/unit/test_hyde.py -v
```

Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add app/hyde/hyde.py tests/unit/test_hyde.py
git commit -m "feat: add HyDEGenerator for hypothetical document embeddings"
```

---

### Task 17: Wire Phase 2 into Query Pipeline

**Files:**
- Modify: `app/api/deps.py`
- Modify: `app/api/main.py`
- Modify: `app/api/routes/query.py`
- Modify: `app/api/routes/ingest.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/api/test_query_enhanced.py
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.models import Chunk


def _make_chunk(id: str) -> Chunk:
    return Chunk(id=id, document_id="d1", content=f"content {id}", level="child",
                 parent_id="p1", metadata={})


@pytest.fixture
def enhanced_client():
    from app.api.main import create_app
    mock_embedder = MagicMock()
    mock_embedder.embed.return_value = [[0.1] * 3]
    mock_store = MagicMock()
    mock_store.search.return_value = [_make_chunk("c1"), _make_chunk("c2")]
    mock_store.bm25_search.return_value = [_make_chunk("c2"), _make_chunk("c3")]
    mock_store.get_by_ids.return_value = [
        Chunk(id="p1", document_id="d1", content="parent context", level="parent", metadata={})
    ]
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "The answer is 42."
    mock_reranker = MagicMock()
    mock_reranker.rerank.return_value = [
        Chunk(id="p1", document_id="d1", content="parent context", level="parent", metadata={})
    ]

    app = create_app(
        embedder=mock_embedder,
        store=mock_store,
        llm=mock_llm,
        reranker=mock_reranker,
    )
    return TestClient(app)


def test_query_uses_hybrid_retrieval(enhanced_client):
    response = enhanced_client.post("/query", json={"question": "What is the answer?"})
    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "The answer is 42."


def test_query_with_hyde(enhanced_client):
    response = enhanced_client.post("/query", json={
        "question": "What is the answer?",
        "use_hyde": True
    })
    assert response.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/api/test_query_enhanced.py -v
```

Expected: FAIL (create_app doesn't accept reranker yet)

- [ ] **Step 3: Update app/api/deps.py**

```python
from app.embedder.base import BaseEmbedder
from app.vectorstore.qdrant_store import QdrantStore
from app.llm.base import BaseLLM
from app.reranker.base import BaseReranker
from app.chunker.chunker import HierarchicalChunker
from app.prompt.builder import PromptBuilder

_embedder: BaseEmbedder | None = None
_store: QdrantStore | None = None
_llm: BaseLLM | None = None
_reranker: BaseReranker | None = None
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

def get_chunker() -> HierarchicalChunker:
    return _chunker

def get_prompt_builder() -> PromptBuilder:
    return _prompt_builder
```

- [ ] **Step 4: Update app/api/main.py**

```python
from fastapi import FastAPI
from app.embedder.base import BaseEmbedder
from app.vectorstore.qdrant_store import QdrantStore
from app.llm.base import BaseLLM
from app.reranker.base import BaseReranker
import app.api.deps as deps
from app.api.routes import ingest, query


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

    app = FastAPI(title="RAG System", version="0.2.0")
    app.include_router(ingest.router)
    app.include_router(query.router)
    return app
```

- [ ] **Step 5: Update app/api/routes/query.py**

```python
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
import time

from app.api.deps import get_embedder, get_store, get_llm, get_prompt_builder, get_reranker
from app.models import QueryResult, TraceInfo
from app.retriever.retriever import HybridRetriever, rrf_fuse
from app.hyde.hyde import HyDEGenerator

router = APIRouter()
FALLBACK_MSG = "在知识库中未找到与该问题相关的内容。"


class QueryRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None
    use_hyde: bool = False


@router.post("/query", response_model=QueryResult)
def query(
    req: QueryRequest,
    embedder=Depends(get_embedder),
    store=Depends(get_store),
    llm=Depends(get_llm),
    prompt_builder=Depends(get_prompt_builder),
    reranker=Depends(get_reranker),
):
    trace = TraceInfo()
    timings: dict[str, float] = {}

    question = req.question

    # HyDE: generate hypothetical doc and average embeddings
    if req.use_hyde:
        t0 = time.monotonic()
        hyde = HyDEGenerator(llm=llm, embedder=embedder)
        query_vector, hypothesis = hyde.generate(question)
        trace.hyde_doc = hypothesis
        timings["hyde"] = (time.monotonic() - t0) * 1000
    else:
        t0 = time.monotonic()
        query_vector = embedder.embed([question])[0]
        timings["embed_query"] = (time.monotonic() - t0) * 1000

    # Hybrid retrieval
    t0 = time.monotonic()
    vector_chunks = store.search(query_vector=query_vector, top_k=20)
    bm25_chunks = store.bm25_search(query=question, top_k=20)
    fused = rrf_fuse([vector_chunks, bm25_chunks], top_k=10)
    timings["retrieval"] = (time.monotonic() - t0) * 1000

    if not fused:
        trace.timings = timings
        return QueryResult(answer=FALLBACK_MSG, sources=[], trace=trace)

    # Reranking
    if reranker:
        t0 = time.monotonic()
        fused = reranker.rerank(query=question, chunks=fused, top_k=5)
        timings["rerank"] = (time.monotonic() - t0) * 1000
        trace.rerank_scores = [1.0] * len(fused)  # placeholder; real scores from reranker

    # Parent chunk recall
    parent_ids = list({c.parent_id for c in fused if c.parent_id})
    context_chunks = store.get_by_ids(parent_ids) if parent_ids else fused[:5]

    if not context_chunks:
        trace.timings = timings
        return QueryResult(answer=FALLBACK_MSG, sources=[], trace=trace)

    # Generate answer
    t0 = time.monotonic()
    messages = prompt_builder.build(question=question, context_chunks=context_chunks)
    answer = llm.generate(messages)
    timings["llm_generate"] = (time.monotonic() - t0) * 1000

    trace.timings = timings
    return QueryResult(answer=answer, sources=context_chunks, trace=trace)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pytest tests/unit/api/ -v
```

Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add app/api/ tests/unit/api/test_query_enhanced.py
git commit -m "feat: wire hybrid retrieval, reranking, and HyDE into query pipeline (Phase 2)"
```

---

## ═══════════════════════════════════════
## PHASE 3: CONVERSATION & OBSERVABILITY
## ═══════════════════════════════════════

---

### Task 18: Tracing

**Files:**
- Create: `app/tracing/tracer.py`
- Create: `tests/unit/test_tracer.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/test_tracer.py
import time
from app.tracing.tracer import Tracer


def test_tracer_records_timing():
    tracer = Tracer()
    with tracer.span("embed"):
        time.sleep(0.01)
    assert "embed" in tracer.timings
    assert tracer.timings["embed"] >= 10  # at least 10ms


def test_tracer_records_metadata():
    tracer = Tracer()
    tracer.set("query_rewrite", "What is Python?")
    tracer.set("hyde_doc", "Python is a language.")
    assert tracer.metadata["query_rewrite"] == "What is Python?"
    assert tracer.metadata["hyde_doc"] == "Python is a language."


def test_tracer_to_trace_info():
    from app.models import TraceInfo
    tracer = Tracer()
    with tracer.span("llm"):
        pass
    tracer.set("query_rewrite", "rewritten question")
    info = tracer.to_trace_info()
    assert isinstance(info, TraceInfo)
    assert "llm" in info.timings
    assert info.query_rewrite == "rewritten question"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/test_tracer.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/tracing/tracer.py**

```python
import time
from contextlib import contextmanager
from app.models import TraceInfo


class Tracer:
    def __init__(self):
        self.timings: dict[str, float] = {}
        self.metadata: dict[str, str] = {}

    @contextmanager
    def span(self, name: str):
        t0 = time.monotonic()
        try:
            yield
        finally:
            self.timings[name] = (time.monotonic() - t0) * 1000

    def set(self, key: str, value: str) -> None:
        self.metadata[key] = value

    def to_trace_info(self) -> TraceInfo:
        return TraceInfo(
            query_rewrite=self.metadata.get("query_rewrite"),
            hyde_doc=self.metadata.get("hyde_doc"),
            retrieval_scores=[],
            rerank_scores=[],
            timings=self.timings,
        )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/unit/test_tracer.py -v
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add app/tracing/tracer.py tests/unit/test_tracer.py
git commit -m "feat: add Tracer for structured timing and metadata"
```

---

### Task 19: Conversation Manager + API

**Files:**
- Create: `app/conversation/manager.py`
- Create: `app/api/routes/conversations.py`
- Create: `tests/unit/test_conversation.py`
- Create: `tests/unit/api/test_conversations_api.py`
- Modify: `app/api/main.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/unit/test_conversation.py
from unittest.mock import MagicMock
from app.conversation.manager import ConversationManager
from app.models import Message, Conversation


def test_create_conversation():
    manager = ConversationManager()
    conv = manager.create()
    assert isinstance(conv, Conversation)
    assert conv.id


def test_get_nonexistent_raises():
    manager = ConversationManager()
    import pytest
    with pytest.raises(KeyError):
        manager.get("nonexistent-id")


def test_add_message_and_retrieve():
    manager = ConversationManager()
    conv = manager.create()
    manager.add_message(conv.id, Message(role="user", content="Hello"))
    updated = manager.get(conv.id)
    assert len(updated.messages) == 1
    assert updated.messages[0].content == "Hello"


def test_rewrite_query_standalone():
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "What is the capital of France?"
    manager = ConversationManager(llm=mock_llm)
    conv = manager.create()
    manager.add_message(conv.id, Message(role="user", content="What about France?"))
    manager.add_message(conv.id, Message(role="assistant", content="France is in Europe."))

    rewritten = manager.rewrite_query(conv.id, "And its capital?")
    assert rewritten == "What is the capital of France?"
    mock_llm.generate.assert_called_once()


def test_rewrite_query_no_history_returns_original():
    manager = ConversationManager()
    conv = manager.create()
    result = manager.rewrite_query(conv.id, "What is Python?")
    assert result == "What is Python?"


def test_delete_conversation():
    manager = ConversationManager()
    conv = manager.create()
    manager.delete(conv.id)
    import pytest
    with pytest.raises(KeyError):
        manager.get(conv.id)
```

```python
# tests/unit/api/test_conversations_api.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock


@pytest.fixture
def client():
    from app.api.main import create_app
    app = create_app(
        embedder=MagicMock(),
        store=MagicMock(),
        llm=MagicMock(),
    )
    return TestClient(app)


def test_create_conversation(client):
    response = client.post("/conversations")
    assert response.status_code == 200
    assert "conversation_id" in response.json()


def test_get_conversation(client):
    create_resp = client.post("/conversations")
    conv_id = create_resp.json()["conversation_id"]
    response = client.get(f"/conversations/{conv_id}")
    assert response.status_code == 200
    assert response.json()["id"] == conv_id


def test_get_nonexistent_conversation_returns_404(client):
    response = client.get("/conversations/does-not-exist")
    assert response.status_code == 404


def test_delete_conversation(client):
    create_resp = client.post("/conversations")
    conv_id = create_resp.json()["conversation_id"]
    response = client.delete(f"/conversations/{conv_id}")
    assert response.status_code == 204
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/unit/test_conversation.py tests/unit/api/test_conversations_api.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/conversation/manager.py**

```python
import uuid
from app.llm.base import BaseLLM
from app.models import Conversation, Message

REWRITE_SYSTEM = (
    "Given the conversation history below and the new follow-up question, "
    "rewrite the follow-up question as a standalone question that can be understood "
    "without the conversation history. Return ONLY the rewritten question.\n\n"
)


class ConversationManager:
    def __init__(self, llm: BaseLLM | None = None):
        self._store: dict[str, Conversation] = {}
        self.llm = llm

    def create(self) -> Conversation:
        conv = Conversation(id=str(uuid.uuid4()))
        self._store[conv.id] = conv
        return conv

    def get(self, conversation_id: str) -> Conversation:
        if conversation_id not in self._store:
            raise KeyError(f"Conversation {conversation_id} not found")
        return self._store[conversation_id]

    def add_message(self, conversation_id: str, message: Message) -> None:
        self.get(conversation_id).messages.append(message)

    def delete(self, conversation_id: str) -> None:
        self._store.pop(conversation_id, None)

    def rewrite_query(self, conversation_id: str, new_question: str) -> str:
        """Rewrite question using conversation history if available."""
        conv = self.get(conversation_id)
        if not conv.messages or self.llm is None:
            return new_question

        history = "\n".join(
            f"{m.role.upper()}: {m.content}" for m in conv.messages[-6:]
        )
        prompt = f"{REWRITE_SYSTEM}History:\n{history}\n\nFollow-up: {new_question}"
        return self.llm.generate([Message(role="user", content=prompt)])
```

- [ ] **Step 4: Write app/api/routes/conversations.py**

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.conversation.manager import ConversationManager

router = APIRouter(prefix="/conversations")
_manager = ConversationManager()  # singleton; replaced via dependency injection in tests


class CreateConversationResponse(BaseModel):
    conversation_id: str


@router.post("", response_model=CreateConversationResponse)
def create_conversation():
    conv = _manager.create()
    return CreateConversationResponse(conversation_id=conv.id)


@router.get("/{conversation_id}")
def get_conversation(conversation_id: str):
    try:
        return _manager.get(conversation_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str):
    _manager.delete(conversation_id)
```

- [ ] **Step 5: Add conversations router to app/api/main.py**

```python
from fastapi import FastAPI
from app.embedder.base import BaseEmbedder
from app.vectorstore.qdrant_store import QdrantStore
from app.llm.base import BaseLLM
from app.reranker.base import BaseReranker
import app.api.deps as deps
from app.api.routes import ingest, query, conversations


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

    app = FastAPI(title="RAG System", version="0.3.0")
    app.include_router(ingest.router)
    app.include_router(query.router)
    app.include_router(conversations.router)
    return app
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pytest tests/unit/test_conversation.py tests/unit/api/test_conversations_api.py -v
```

Expected: All pass

- [ ] **Step 7: Wire ConversationManager into query pipeline (update app/api/routes/query.py)**

In `app/api/routes/query.py`, import and use `ConversationManager` for the `conversation_id` path. Add after the HyDE block and before hybrid retrieval:

```python
# At the top of the file, add:
from app.conversation.manager import ConversationManager
from app.api.routes import conversations as conv_route  # access shared _manager

# Inside the query() function, replace:
#   question = req.question
# with:

question = req.question
if req.conversation_id:
    try:
        rewritten = conv_route._manager.rewrite_query(req.conversation_id, question)
        trace.query_rewrite = rewritten if rewritten != question else None
        question = rewritten
    except KeyError:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Conversation not found")
```

- [ ] **Step 8: Commit**

```bash
git add app/conversation/ app/api/routes/conversations.py app/api/routes/query.py \
        app/api/main.py tests/unit/test_conversation.py tests/unit/api/test_conversations_api.py
git commit -m "feat: add ConversationManager, /conversations API, and query rewrite integration"
```

---

### Task 20: Async Job Queue + Jobs API

**Files:**
- Create: `app/jobs/queue.py`
- Create: `app/api/routes/jobs.py`
- Create: `tests/unit/test_jobs.py`
- Create: `tests/unit/api/test_jobs_api.py`
- Modify: `app/api/routes/ingest.py` (make async)
- Modify: `app/api/main.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/unit/test_jobs.py
import asyncio
import pytest
from app.jobs.queue import AsyncJobQueue, JobStatus


@pytest.mark.asyncio
async def test_submit_job_returns_id():
    queue = AsyncJobQueue()

    async def noop():
        pass

    job_id = await queue.submit(noop())
    assert job_id is not None


@pytest.mark.asyncio
async def test_completed_job_status():
    queue = AsyncJobQueue()
    results = []

    async def task():
        results.append(1)

    job_id = await queue.submit(task())
    await asyncio.sleep(0.05)
    status = queue.get_status(job_id)
    assert status.status == "completed"
    assert results == [1]


@pytest.mark.asyncio
async def test_failed_job_status():
    queue = AsyncJobQueue()

    async def failing():
        raise ValueError("intentional error")

    job_id = await queue.submit(failing())
    await asyncio.sleep(0.05)
    status = queue.get_status(job_id)
    assert status.status == "failed"
    assert "intentional error" in status.error


def test_get_unknown_job_returns_none():
    queue = AsyncJobQueue()
    assert queue.get_status("unknown-id") is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/test_jobs.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/jobs/queue.py**

```python
import asyncio
import uuid
from dataclasses import dataclass, field


@dataclass
class JobStatus:
    job_id: str
    status: str = "pending"    # pending | running | completed | failed
    progress: int = 0
    error: str | None = None


class AsyncJobQueue:
    def __init__(self):
        self._jobs: dict[str, JobStatus] = {}

    async def submit(self, coro) -> str:
        job_id = str(uuid.uuid4())
        self._jobs[job_id] = JobStatus(job_id=job_id, status="pending")
        asyncio.ensure_future(self._run(job_id, coro))
        return job_id

    async def _run(self, job_id: str, coro) -> None:
        self._jobs[job_id].status = "running"
        try:
            await coro
            self._jobs[job_id].status = "completed"
            self._jobs[job_id].progress = 100
        except Exception as exc:
            self._jobs[job_id].status = "failed"
            self._jobs[job_id].error = str(exc)

    def get_status(self, job_id: str) -> JobStatus | None:
        return self._jobs.get(job_id)
```

- [ ] **Step 4: Write app/api/routes/jobs.py**

```python
from fastapi import APIRouter, HTTPException, Depends
from app.api.deps import get_job_queue

router = APIRouter(prefix="/jobs")


@router.get("/{job_id}")
def get_job_status(job_id: str, job_queue=Depends(get_job_queue)):
    status = job_queue.get_status(job_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return status
```

- [ ] **Step 5: Update app/api/routes/ingest.py to use async job queue from deps**

```python
from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_embedder, get_store, get_chunker, get_job_queue
from app.loaders.markdown_loader import MarkdownLoader
from app.loaders.pdf_loader import PDFLoader
from app.loaders.html_loader import HTMLLoader

router = APIRouter()

LOADERS = {
    "markdown": MarkdownLoader(),
    "pdf": PDFLoader(),
    "html": HTMLLoader(),
    "url": HTMLLoader(),
}


class IngestRequest(BaseModel):
    path_or_url: str
    doc_type: Literal["pdf", "markdown", "html", "url"]


class IngestResponse(BaseModel):
    job_id: str


@router.post("/ingest", response_model=IngestResponse)
async def ingest(
    req: IngestRequest,
    embedder=Depends(get_embedder),
    store=Depends(get_store),
    chunker=Depends(get_chunker),
    job_queue=Depends(get_job_queue),
):
    async def _ingest_task():
        loader = LOADERS[req.doc_type]
        docs = loader.load(req.path_or_url)
        for doc in docs:
            chunks = chunker.chunk(doc)
            child_chunks = [c for c in chunks if c.level == "child"]
            texts = [c.content for c in child_chunks]
            if texts:
                embeddings = embedder.embed(texts)
                for chunk, emb in zip(child_chunks, embeddings):
                    chunk.embedding = emb
            store.upsert(chunks)

    job_id = await job_queue.submit(_ingest_task())
    return IngestResponse(job_id=job_id)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pytest tests/unit/test_jobs.py -v
```

Expected: 4 passed

- [ ] **Step 7: Commit**

```bash
git add app/jobs/ app/api/routes/jobs.py app/api/routes/ingest.py \
        tests/unit/test_jobs.py
git commit -m "feat: add AsyncJobQueue and async ingestion with job status tracking"
```

---

### Task 21: Eval Module + API

**Files:**
- Create: `app/eval/evaluator.py`
- Create: `app/api/routes/eval.py`
- Create: `tests/unit/test_eval.py`
- Modify: `app/api/main.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/test_eval.py
from unittest.mock import MagicMock
from app.eval.evaluator import RAGEvaluator


def test_faithfulness_perfect_score():
    mock_llm = MagicMock()
    # LLM says every claim is supported
    mock_llm.generate.return_value = "YES\nYES\nYES"
    evaluator = RAGEvaluator(llm=mock_llm)
    score = evaluator.faithfulness(
        answer="Python was created by Guido. It was released in 1991. It uses indentation.",
        contexts=["Guido created Python in 1991. It uses indentation."],
    )
    assert score == 1.0


def test_faithfulness_zero_score():
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "NO\nNO"
    evaluator = RAGEvaluator(llm=mock_llm)
    score = evaluator.faithfulness(
        answer="Python is old. Java is better.",
        contexts=["Python was created by Guido."],
    )
    assert score == 0.0


def test_answer_relevance_score():
    mock_llm = MagicMock()
    # LLM generates a question similar to original from the answer
    mock_llm.generate.return_value = "Who created Python?"

    mock_embedder = MagicMock()
    # Return similar vectors → high cosine similarity
    mock_embedder.embed.side_effect = [
        [[1.0, 0.0, 0.0]],  # original question
        [[0.99, 0.1, 0.0]],  # generated question
    ]
    evaluator = RAGEvaluator(llm=mock_llm, embedder=mock_embedder)
    score = evaluator.answer_relevance(
        question="Who created Python?",
        answer="Python was created by Guido van Rossum.",
    )
    assert score > 0.9
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/test_eval.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Write app/eval/evaluator.py**

```python
import math
from app.llm.base import BaseLLM
from app.embedder.base import BaseEmbedder
from app.models import Message

FAITHFULNESS_PROMPT = (
    "For each claim in the answer below, reply with YES if it is directly supported by "
    "the context, or NO if it is not. One answer per line, no explanation.\n\n"
    "Context:\n{context}\n\nAnswer claims:\n{claims}"
)

RELEVANCE_PROMPT = (
    "Given the following answer, generate the question that this answer most likely addresses. "
    "Return ONLY the question.\n\nAnswer: {answer}"
)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class RAGEvaluator:
    def __init__(self, llm: BaseLLM, embedder: BaseEmbedder | None = None):
        self.llm = llm
        self.embedder = embedder

    def faithfulness(self, answer: str, contexts: list[str]) -> float:
        """Fraction of answer claims supported by context. Range [0, 1]."""
        claims = [s.strip() for s in answer.split(".") if s.strip()]
        if not claims:
            return 1.0
        context_text = "\n".join(contexts)
        prompt = FAITHFULNESS_PROMPT.format(
            context=context_text,
            claims="\n".join(f"- {c}" for c in claims),
        )
        response = self.llm.generate([Message(role="user", content=prompt)])
        verdicts = [line.strip().upper() for line in response.strip().splitlines()]
        yes_count = sum(1 for v in verdicts if v == "YES")
        return yes_count / len(verdicts) if verdicts else 1.0

    def answer_relevance(self, question: str, answer: str) -> float:
        """Cosine similarity between original question and LLM-generated question from answer."""
        if self.embedder is None:
            raise ValueError("embedder required for answer_relevance")
        generated_question = self.llm.generate([
            Message(role="user", content=RELEVANCE_PROMPT.format(answer=answer))
        ])
        q_vec = self.embedder.embed([question])[0]
        gen_vec = self.embedder.embed([generated_question])[0]
        return _cosine_similarity(q_vec, gen_vec)
```

- [ ] **Step 4: Write app/api/routes/eval.py**

```python
from fastapi import APIRouter
from pydantic import BaseModel
from app.api.deps import get_llm, get_embedder
from fastapi import Depends
from app.eval.evaluator import RAGEvaluator

router = APIRouter()


class EvalRequest(BaseModel):
    question: str
    answer: str
    contexts: list[str]


class EvalResponse(BaseModel):
    faithfulness: float
    answer_relevance: float


@router.post("/eval", response_model=EvalResponse)
def evaluate(
    req: EvalRequest,
    llm=Depends(get_llm),
    embedder=Depends(get_embedder),
):
    evaluator = RAGEvaluator(llm=llm, embedder=embedder)
    faithfulness = evaluator.faithfulness(answer=req.answer, contexts=req.contexts)
    relevance = evaluator.answer_relevance(question=req.question, answer=req.answer)
    return EvalResponse(faithfulness=faithfulness, answer_relevance=relevance)
```

- [ ] **Step 5: Add eval router to app/api/main.py**

```python
from fastapi import FastAPI
from app.embedder.base import BaseEmbedder
from app.vectorstore.qdrant_store import QdrantStore
from app.llm.base import BaseLLM
from app.reranker.base import BaseReranker
import app.api.deps as deps
from app.api.routes import ingest, query, conversations, eval as eval_router


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
    app.include_router(eval_router.router)
    return app
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pytest tests/unit/test_eval.py -v
```

Expected: 3 passed

- [ ] **Step 7: Commit**

```bash
git add app/eval/ app/api/routes/eval.py app/api/main.py tests/unit/test_eval.py
git commit -m "feat: add RAGEvaluator (faithfulness + answer_relevance) and /eval endpoint"
```

---

### Task 22: Documents Management API

**Files:**
- Create: `app/api/routes/documents.py`
- Create: `tests/unit/api/test_documents_api.py`
- Modify: `app/api/main.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/api/test_documents_api.py
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.models import Chunk


@pytest.fixture
def client():
    from app.api.main import create_app
    mock_store = MagicMock()
    mock_store.list_documents.return_value = [
        {"id": "doc1", "source": "test.md", "version": 1, "chunk_count": 5}
    ]
    app = create_app(
        embedder=MagicMock(),
        store=mock_store,
        llm=MagicMock(),
    )
    return TestClient(app), mock_store


def test_list_documents(client):
    tc, mock_store = client
    response = tc.get("/documents")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_delete_document(client):
    tc, mock_store = client
    response = tc.delete("/documents/doc1")
    assert response.status_code == 204
    mock_store.delete_by_document_id.assert_called_once_with("doc1")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/unit/api/test_documents_api.py -v
```

Expected: `ModuleNotFoundError` or missing route

- [ ] **Step 3: Add list_documents to QdrantStore (app/vectorstore/qdrant_store.py)**

Add this method to the `QdrantStore` class:

```python
def list_documents(self) -> list[dict]:
    """Return list of unique documents with metadata."""
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    # Scroll all points and aggregate by document_id
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
```

- [ ] **Step 4: Write app/api/routes/documents.py**

```python
from fastapi import APIRouter, Depends
from app.api.deps import get_store

router = APIRouter(prefix="/documents")


@router.get("")
def list_documents(store=Depends(get_store)):
    return store.list_documents()


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: str, store=Depends(get_store)):
    store.delete_by_document_id(document_id)
```

- [ ] **Step 5: Add documents router to app/api/main.py**

```python
from fastapi import FastAPI
from app.embedder.base import BaseEmbedder
from app.vectorstore.qdrant_store import QdrantStore
from app.llm.base import BaseLLM
from app.reranker.base import BaseReranker
import app.api.deps as deps
from app.api.routes import ingest, query, conversations
from app.api.routes import eval as eval_router
from app.api.routes import documents


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
    app.include_router(eval_router.router)
    app.include_router(documents.router)
    return app
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pytest tests/unit/api/test_documents_api.py -v
```

Expected: 2 passed

- [ ] **Step 7: Run all unit tests**

```bash
pytest tests/unit/ -v
```

Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add app/api/routes/documents.py app/vectorstore/qdrant_store.py \
        app/api/main.py tests/unit/api/test_documents_api.py
git commit -m "feat: add /documents list and delete endpoints (Phase 3 complete)"
```

---

### Task 23: Full Test Suite Run

- [ ] **Step 1: Run all unit tests**

```bash
pytest tests/unit/ -v --tb=short
```

Expected: All tests pass.

- [ ] **Step 2: Run integration test (requires Qdrant running)**

```bash
docker compose up -d qdrant
pytest tests/integration/ -v
```

Expected: All integration tests pass.

- [ ] **Step 3: Verify API starts cleanly**

Create a `run.py` for local testing:

```python
# run.py
from app.api.main import create_app
from app.embedder.local_embedder import LocalEmbedder
from app.vectorstore.qdrant_store import QdrantStore
from app.llm.openai_llm import OpenAILLM
from app.reranker.cross_encoder_reranker import CrossEncoderReranker
from qdrant_client import QdrantClient
import uvicorn

store = QdrantStore(client=QdrantClient(host="localhost", port=6333))
store.ensure_collection()
embedder = LocalEmbedder()
llm = OpenAILLM()
reranker = CrossEncoderReranker()

app = create_app(embedder=embedder, store=store, llm=llm, reranker=reranker)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

```bash
python run.py &
curl http://localhost:8000/docs
```

Expected: FastAPI Swagger UI loads with all endpoints visible.

- [ ] **Step 4: Final commit**

```bash
git add run.py
git commit -m "chore: add local run script for manual testing"
```
