import time
from app.tracing.tracer import Tracer


def test_tracer_records_timing():
    tracer = Tracer()
    with tracer.span("embed"):
        time.sleep(0.01)
    assert "embed" in tracer.timings
    assert tracer.timings["embed"] >= 10


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
