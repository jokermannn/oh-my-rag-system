from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.conversation.manager import ConversationManager

router = APIRouter(prefix="/conversations")
_manager = ConversationManager()


class CreateConversationResponse(BaseModel):
    conversation_id: str


@router.post("", response_model=CreateConversationResponse)
def create_conversation():
    conv = _manager.create()
    return CreateConversationResponse(conversation_id=conv.id)


@router.get("/{conversation_id}")
def get_conversation(conversation_id: str):
    try:
        return _manager.get(conversation_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str):
    _manager.delete(conversation_id)
