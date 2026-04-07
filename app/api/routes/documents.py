from fastapi import APIRouter, Depends

from app.api.deps import get_store

router = APIRouter(prefix="/documents")


@router.get("")
def list_documents(store=Depends(get_store)):
    return store.list_documents()


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: str, store=Depends(get_store)):
    store.delete_by_document_id(document_id)
