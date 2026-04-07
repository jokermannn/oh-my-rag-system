"""
Local development entry point.
Requires: Qdrant running via `docker compose up -d qdrant`
Requires: OPENAI_API_KEY environment variable set (for OpenAILLM)
"""
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
