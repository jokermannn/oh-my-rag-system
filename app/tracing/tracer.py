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
