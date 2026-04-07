import pytest


@pytest.fixture
def sample_text() -> str:
    return "Python is a programming language. " * 50
