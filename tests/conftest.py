import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def sample_text() -> str:
    return "Python is a programming language. " * 50
