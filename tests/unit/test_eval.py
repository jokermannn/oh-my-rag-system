from unittest.mock import MagicMock

from app.eval.evaluator import RAGEvaluator


def test_faithfulness_perfect_score():
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "YES\nYES\nYES"
    evaluator = RAGEvaluator(llm=mock_llm)
    score = evaluator.faithfulness(
        answer="Python was created by Guido. It was released in 1991. It uses indentation.",
        contexts=["Guido created Python in 1991. It uses indentation."],
    )
    assert score == 1.0


def test_faithfulness_zero_score():
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "NO\nNO"
    evaluator = RAGEvaluator(llm=mock_llm)
    score = evaluator.faithfulness(
        answer="Python is old. Java is better.",
        contexts=["Python was created by Guido."],
    )
    assert score == 0.0


def test_answer_relevance_score():
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "Who created Python?"
    mock_embedder = MagicMock()
    mock_embedder.embed.side_effect = [
        [[1.0, 0.0, 0.0]],
        [[0.99, 0.1, 0.0]],
    ]
    evaluator = RAGEvaluator(llm=mock_llm, embedder=mock_embedder)
    score = evaluator.answer_relevance(
        question="Who created Python?",
        answer="Python was created by Guido van Rossum.",
    )
    assert score > 0.9
