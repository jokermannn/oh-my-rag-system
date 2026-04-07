"""
Entry point for local dev and Docker.
Env vars:
  QDRANT_HOST          Qdrant host (default: localhost)
  QDRANT_PORT          Qdrant port (default: 6333)
  OPENAI_API_KEY       Required for OpenAILLM
  OPENROUTER_API_KEY   Required for OpenRouterLLM
  OPENROUTER_MODEL     OpenRouter model slug (default: openai/gpt-4o-mini)

To switch LLM, replace OpenAILLM() with:
  from app.llm.openrouter_llm import OpenRouterLLM;  llm = OpenRouterLLM()
  from app.llm.anthropic_llm import AnthropicLLM;    llm = AnthropicLLM()
  from app.llm.ollama_llm import OllamaLLM;          llm = OllamaLLM()
"""
import os
from app.api.main import create_app
from app.embedder.local_embedder import LocalEmbedder
from app.vectorstore.qdrant_store import QdrantStore
from app.llm.openai_llm import OpenAILLM
from app.reranker.cross_encoder_reranker import CrossEncoderReranker
from qdrant_client import QdrantClient
import uvicorn

qdrant_host = os.getenv("QDRANT_HOST", "localhost")
qdrant_port = int(os.getenv("QDRANT_PORT", "6333"))
store = QdrantStore(client=QdrantClient(host=qdrant_host, port=qdrant_port))
store.ensure_collection()
embedder = LocalEmbedder()
llm = OpenAILLM()
reranker = CrossEncoderReranker()

app = create_app(embedder=embedder, store=store, llm=llm, reranker=reranker)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
