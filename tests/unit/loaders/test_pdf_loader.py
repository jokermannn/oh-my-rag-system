import tempfile

import fitz  # pymupdf

from app.loaders.pdf_loader import PDFLoader


def _make_pdf(text: str) -> str:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 100), text)
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        doc.save(f.name)
        return f.name


def test_loads_pdf_content():
    path = _make_pdf("Hello from PDF page one.")
    loader = PDFLoader()
    docs = loader.load(path)
    assert len(docs) == 1
    assert "Hello from PDF" in docs[0].content
    assert docs[0].metadata["doc_type"] == "pdf"
    assert docs[0].metadata["page_count"] == 1


def test_pdf_source_is_path():
    path = _make_pdf("test")
    loader = PDFLoader()
    docs = loader.load(path)
    assert docs[0].source == path
