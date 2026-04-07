import tempfile

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
