from unittest.mock import MagicMock
from app.dedup.dedup import DedupManager
from app.models import Document


def _make_doc(content: str, source: str = "test.md") -> Document:
    return Document(source=source, content=content, metadata={})


def test_new_document_is_not_duplicate():
    mock_store = MagicMock()
    mock_store.get_by_ids.return_value = []
    manager = DedupManager(store=mock_store)
    doc = _make_doc("new content")
    result = manager.check(doc)
    assert result.is_duplicate is False
    assert result.is_update is False


def test_identical_content_is_duplicate():
    doc = _make_doc("same content")
    mock_store = MagicMock()
    mock_store.get_by_ids.return_value = [MagicMock(document_id=doc.id)]
    manager = DedupManager(store=mock_store)
    result = manager.check(doc)
    assert result.is_duplicate is True


def test_same_source_different_content_is_update():
    old_doc = _make_doc("old content", source="file.md")
    new_doc = _make_doc("new content", source="file.md")
    mock_store = MagicMock()
    manager = DedupManager(store=mock_store)
    manager._source_registry[new_doc.source] = old_doc.id
    result = manager.check(new_doc)
    assert result.is_update is True
    assert result.old_document_id == old_doc.id
