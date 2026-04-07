from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_chunker, get_embedder, get_job_queue, get_store
from app.loaders.html_loader import HTMLLoader
from app.loaders.markdown_loader import MarkdownLoader
from app.loaders.pdf_loader import PDFLoader

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
