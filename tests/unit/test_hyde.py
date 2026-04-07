from unittest.mock import MagicMock

from app.hyde.hyde import HyDEGenerator


def test_hyde_generates_hypothesis_and_averages_embeddings():
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "Python was created by Guido van Rossum in 1991."

    mock_embedder = MagicMock()
    mock_embedder.embed.side_effect = [
        [[1.0, 0.0, 0.0]],
        [[0.0, 1.0, 0.0]],
    ]

    generator = HyDEGenerator(llm=mock_llm, embedder=mock_embedder)
    result_vec, hypothesis = generator.generate("Who created Python?")

    assert hypothesis == "Python was created by Guido van Rossum in 1991."
    assert abs(result_vec[0] - 0.5) < 1e-6
    assert abs(result_vec[1] - 0.5) < 1e-6
    assert abs(result_vec[2] - 0.0) < 1e-6


def test_hyde_uses_question_only_if_llm_fails():
    mock_llm = MagicMock()
    mock_llm.generate.side_effect = Exception("LLM error")
    mock_embedder = MagicMock()
    mock_embedder.embed.return_value = [[0.5, 0.5, 0.0]]

    generator = HyDEGenerator(llm=mock_llm, embedder=mock_embedder)
    result_vec, hypothesis = generator.generate("Who created Python?")

    assert hypothesis is None
    assert result_vec == [0.5, 0.5, 0.0]
