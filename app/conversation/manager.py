import uuid

from app.llm.base import BaseLLM
from app.models import Conversation, Message

REWRITE_SYSTEM = (
    "Given the conversation history below and the new follow-up question, "
    "rewrite the follow-up question as a standalone question that can be understood "
    "without the conversation history. Return ONLY the rewritten question.\n\n"
)


class ConversationManager:
    def __init__(self, llm: BaseLLM | None = None):
        self._store: dict[str, Conversation] = {}
        self.llm = llm

    def create(self) -> Conversation:
        conv = Conversation(id=str(uuid.uuid4()))
        self._store[conv.id] = conv
        return conv

    def get(self, conversation_id: str) -> Conversation:
        if conversation_id not in self._store:
            raise KeyError(f"Conversation {conversation_id} not found")
        return self._store[conversation_id]

    def add_message(self, conversation_id: str, message: Message) -> None:
        self.get(conversation_id).messages.append(message)

    def delete(self, conversation_id: str) -> None:
        self._store.pop(conversation_id, None)

    def rewrite_query(self, conversation_id: str, new_question: str) -> str:
        conv = self.get(conversation_id)
        if not conv.messages or self.llm is None:
            return new_question
        history = "\n".join(f"{m.role.upper()}: {m.content}" for m in conv.messages[-6:])
        prompt = f"{REWRITE_SYSTEM}History:\n{history}\n\nFollow-up: {new_question}"
        return self.llm.generate([Message(role="user", content=prompt)])
