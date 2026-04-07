# Oh My RAG System

A production-grade Retrieval Augmented Generation (RAG) system with a React frontend. Built with FastAPI, Qdrant, and pluggable LLM backends.

![CI](https://github.com/jokermannn/oh-my-rag-system/actions/workflows/ci.yml/badge.svg)
![CD](https://github.com/jokermannn/oh-my-rag-system/actions/workflows/cd.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

**Retrieval**
- Hybrid search — dense vector + BM25 sparse, fused with Reciprocal Rank Fusion (RRF)
- HyDE (Hypothetical Document Embeddings) — generates a hypothesis before retrieval
- Cross-Encoder reranking for precision
- Hierarchical chunking — parent (~512 tokens) + child (~128 tokens) with parent recall

**Ingestion**
- Supports Markdown, PDF, and HTML/URL documents
- SHA-256 content deduplication; re-ingest detects version changes
- Async job queue — ingest returns a job ID immediately

**Generation**
- Pluggable LLM: OpenRouter (default), OpenAI, Anthropic, Ollama
- Multi-turn conversations with LLM-based query rewriting
- Full trace info (timings, rewrite, HyDE hypothesis, retrieval/rerank scores)

**Evaluation**
- Faithfulness scoring (LLM verdict)
- Answer relevance scoring (cosine similarity)

**Frontend**
- React + nginx chat interface
- Document library sidebar
- Expandable source citations

## Architecture

```
Browser
  └── http://localhost:80
        └── nginx (frontend image)
              ├── /                   → React SPA (static files)
              └── /query, /ingest...  → http://app:8000 (proxy)
                    └── FastAPI (backend image)
                          ├── LocalEmbedder (all-MiniLM-L6-v2)
                          ├── OpenRouterLLM / OpenAI / Anthropic / Ollama
                          └── Qdrant :6333 (vector store)
```

## Quick Start

```bash
# 1. Clone
git clone https://github.com/jokermannn/oh-my-rag-system.git
cd oh-my-rag-system

# 2. Configure
cp .env.example .env   # fill in OPENROUTER_API_KEY

# 3. Start everything
docker compose up -d
```

Open http://localhost

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```env
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=qwen/qwen3.6-plus:free   # any model on openrouter.ai/models

# Optional — only needed if switching LLM in run.py
# OPENAI_API_KEY=sk-...
```

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | — | Required for default LLM |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | Any OpenRouter model slug |
| `QDRANT_HOST` | `localhost` | Qdrant host |
| `QDRANT_PORT` | `6333` | Qdrant port |

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ingest` | Ingest a document by path or URL |
| `POST` | `/query` | Ask a question, get an answer with sources |
| `GET` | `/documents` | List all indexed documents |
| `DELETE` | `/documents/{id}` | Delete a document and its chunks |
| `GET` | `/jobs/{id}` | Check ingestion job status |
| `POST` | `/conversations` | Create a conversation |
| `POST` | `/conversations/{id}/query` | Query within a conversation |
| `POST` | `/eval` | Evaluate answer faithfulness and relevance |

**Ingest a document**
```bash
curl -X POST http://localhost/ingest \
  -H "Content-Type: application/json" \
  -d '{"path_or_url": "https://example.com/doc.html", "doc_type": "html"}'
```

**Query**
```bash
curl -X POST http://localhost/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is this document about?", "use_hyde": true}'
```

## Project Structure

```
app/
├── api/          FastAPI routes and dependency injection
├── chunker/      Hierarchical chunker (tiktoken)
├── conversation/ Multi-turn conversation manager
├── dedup/        SHA-256 content deduplication
├── embedder/     Local (sentence-transformers) and OpenAI embedders
├── eval/         Faithfulness + answer relevance evaluation
├── hyde/         Hypothetical Document Embeddings
├── jobs/         Async ingestion job queue
├── llm/          OpenRouter, OpenAI, Anthropic, Ollama LLM clients
├── loaders/      Markdown, PDF, HTML document loaders
├── prompt/       RAG prompt builder
├── reranker/     Cross-Encoder reranker
├── retriever/    Hybrid retriever with RRF fusion
├── tracing/      Request tracing
└── vectorstore/  Qdrant vector store

frontend/         React + Vite app, served by nginx
k8s/              Kubernetes manifests
```

## Development

```bash
# Backend
docker compose up -d qdrant
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -e ".[dev]"
OPENROUTER_API_KEY=sk-or-... python run.py   # http://localhost:8000

# Frontend
cd frontend && npm install && npm run dev     # http://localhost:5173
```

## Testing

```bash
# Unit tests (no external dependencies)
pytest tests/unit/ -v

# Integration tests (requires Qdrant)
NO_PROXY="localhost,127.0.0.1" pytest tests/integration/test_pipeline.py -v

# OpenRouter integration tests (requires OPENROUTER_API_KEY)
OPENROUTER_API_KEY=sk-or-... pytest tests/integration/test_openrouter.py -v
```

## Switching LLMs

```python
# run.py
from app.llm.openrouter_llm import OpenRouterLLM   # default
from app.llm.openai_llm import OpenAILLM
from app.llm.anthropic_llm import AnthropicLLM
from app.llm.ollama_llm import OllamaLLM

llm = OpenRouterLLM(model="anthropic/claude-3.5-sonnet")
```

## Deployment

**Docker images** (built automatically by CD on every push to master):

| Image | Description |
|-------|-------------|
| `ghcr.io/jokermannn/oh-my-rag-system:latest` | FastAPI backend |
| `ghcr.io/jokermannn/oh-my-rag-system-frontend:latest` | nginx + React frontend |

**Kubernetes**
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/qdrant/
kubectl apply -f k8s/app/
```

## License

MIT — see [LICENSE](LICENSE)
