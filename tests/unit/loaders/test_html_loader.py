import tempfile
from unittest.mock import MagicMock, patch

from app.loaders.html_loader import HTMLLoader


def test_loads_local_html_file():
    html = "<html><body><h1>Title</h1><p>Some paragraph.</p></body></html>"
    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", delete=False) as f:
        f.write(html)
        path = f.name

    loader = HTMLLoader()
    docs = loader.load(path)
    assert len(docs) == 1
    assert "Title" in docs[0].content
    assert "Some paragraph" in docs[0].content
    assert docs[0].metadata["doc_type"] == "html"


def test_loads_remote_url():
    html = "<html><body><p>Remote content.</p></body></html>"
    mock_response = MagicMock()
    mock_response.text = html
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.get", return_value=mock_response):
        loader = HTMLLoader()
        docs = loader.load("https://example.com/page")

    assert "Remote content" in docs[0].content
    assert docs[0].metadata["doc_type"] == "url"
