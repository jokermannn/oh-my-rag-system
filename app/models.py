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
