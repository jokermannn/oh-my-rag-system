import pytest
import tiktoken

from app.chunker.chunker import HierarchicalChunker
from app.models import Document


@pytest.fixture
def doc():
    return Document(
        source="test.md",
        content="This is a sentence about machine learning. " * 100,
        metadata={}
    )


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
    if len(children) >= 2:
        enc = tiktoken.get_encoding("cl100k_base")
        t1 = set(enc.encode(children[0].content))
        t2 = set(enc.encode(children[1].content))
        assert len(t1 & t2) > 0
