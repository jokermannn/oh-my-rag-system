# Oh My RAG System

A production-grade Retrieval Augmented Generation (RAG) system with a React frontend. Built with FastAPI, Qdrant, and pluggable LLM backends.

![CI](https://github.com/jokermannn/oh-my-rag-system/actions/workflows/ci.yml/badge.svg)
![CD](https://github.com/jokermannn/oh-my-rag-system/actions/workflows/cd.yml/badge.svg)

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
- Pluggable LLM: OpenAI, Anthropic, Ollama
- Multi-turn conversations with LLM-based query rewriting
- Full trace info (timings, rewrite, HyDE hypothesis, retrieval/rerank scores)

**Evaluation**
- Faithfulness scoring (LLM verdict)
- Answer relevance scoring (cosine similarity)

**Frontend**
- React + Vite chat interface
- Document library sidebar
- Expandable source citations

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────────┐
│  React UI   │────▶│  FastAPI                                      │
│  :5173      │     │  /ingest  /query  /documents  /conversations  │
└─────────────┘     └──────────┬───────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        Qdrant :6333     LocalEmbedder     OpenAI / Anthropic
        (vector store)   (all-MiniLM-L6)   / Ollama (LLM)
```

## Quick Start

### Docker Compose (recommended)

```bash
# 1. Set your OpenAI API key
echo "OPENAI_API_KEY=sk-..." > .env

# 2. Start backend + Qdrant
docker compose up -d

# 3. Start the frontend
cd frontend && npm install && npm run dev
```

Open http://localhost:5173

### Local Development

**Prerequisites:** Python 3.11+, [Qdrant running via Docker](https://qdrant.tech/documentation/quick-start/)

```bash
# Start Qdrant
docker compose up -d qdrant

# Install dependencies (CPU-only torch)
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -e ".[dev]"

# Run the API server
OPENAI_API_KEY=sk-... python run.py
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ingest` | Ingest a document by path or URL |
| `POST` | `/query` | Ask a question, get an answer with sources |
| `GET` | `/documents` | List all indexed documents |
| `DELETE` | `/documents/{id}` | Delete a document and its chunks |
| `GET` | `/jobs/{id}` | Check ingestion job status |
| `POST` | `/conversations` | Create a conversation |
| `POST` | `/conversations/{id}/query` | Query within a conversation (with rewrite) |
| `POST` | `/eval` | Evaluate answer faithfulness and relevance |

**Ingest a document**
```bash
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"path_or_url": "/path/to/doc.md", "doc_type": "markdown"}'
```

**Query**
```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is this document about?", "use_hyde": true}'
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `QDRANT_HOST` | `localhost` | Qdrant host |
| `QDRANT_PORT` | `6333` | Qdrant port |
| `OPENAI_API_KEY` | — | Required for OpenAI LLM / embedder |
| `ANTHROPIC_API_KEY` | — | Required for Anthropic LLM |

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
├── llm/          OpenAI, Anthropic, Ollama LLM clients
├── loaders/      Markdown, PDF, HTML document loaders
├── prompt/       RAG prompt builder
├── reranker/     Cross-Encoder reranker
├── retriever/    Hybrid retriever with RRF fusion
├── tracing/      Request tracing
└── vectorstore/  Qdrant vector store

frontend/         React + Vite frontend
k8s/              Kubernetes manifests
```

## Testing

```bash
# Unit tests (no external dependencies)
pytest tests/unit/ -v

# Integration tests (requires Qdrant running)
NO_PROXY="localhost,127.0.0.1" pytest tests/integration/ -v
```

## Deployment

### Docker Image

The CD pipeline automatically builds and pushes a multi-arch image (`amd64` + `arm64`) to GitHub Container Registry on every push to `master`.

```bash
docker pull ghcr.io/jokermannn/oh-my-rag-system:latest
```

### Kubernetes

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/qdrant/
kubectl apply -f k8s/app/
```

See [`k8s/app/secret.example.yaml`](k8s/app/secret.example.yaml) for required secrets.

## Switching LLMs

```python
# OpenAI (default)
from app.llm.openai_llm import OpenAILLM
llm = OpenAILLM(model="gpt-4o-mini")

# Anthropic
from app.llm.anthropic_llm import AnthropicLLM
llm = AnthropicLLM()

# Ollama (local)
from app.llm.ollama_llm import OllamaLLM
llm = OllamaLLM(model="llama3")
```

Pass any LLM to `create_app(embedder=..., store=..., llm=llm)`.
