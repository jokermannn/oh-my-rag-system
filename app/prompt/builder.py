from app.models import Chunk, Message

SYSTEM_PROMPT = """You are a helpful assistant that answers questions based on the provided context.
Answer only from the context below. If the context does not contain enough information to answer, say:
"在知识库中未找到与该问题相关的内容。"
Always cite which context passage your answer comes from."""


class PromptBuilder:
    def build(self, question: str, context_chunks: list[Chunk]) -> list[Message]:
        if not context_chunks:
            raise ValueError("context_chunks must not be empty")

        context_parts = []
        for i, chunk in enumerate(context_chunks, 1):
            context_parts.append(f"[{i}] {chunk.content}")
        context_text = "\n\n".join(context_parts)

        user_content = f"""Context:
{context_text}

Question: {question}

Answer:"""

        return [
            Message(role="user", content=SYSTEM_PROMPT + "\n\n" + user_content)
        ]
