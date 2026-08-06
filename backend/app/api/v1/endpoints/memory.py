from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.agents.memory import add_user_memory, search_user_memory
from app.schemas.memory import UserMemoryCreate, UserMemoryResponse, MemorySearchQuery, MemorySearchResult

router = APIRouter()

@router.post("/add", response_model=UserMemoryResponse)
def add_memory(
    payload: UserMemoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save a new personalization memory preference for a user.
    """
    try:
        mem = add_user_memory(
            db=db,
            user_id=current_user.id,
            category=payload.category,
            content=payload.content
        )
        return mem
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add memory: {str(e)}")

@router.post("/search", response_model=List[MemorySearchResult])
def search_memory(
    payload: MemorySearchQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Perform semantic search over user profile memory preferences.
    """
    try:
        results = search_user_memory(
            db=db,
            user_id=current_user.id,
            query_text=payload.query,
            category=payload.category,
            limit=5
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search memories: {str(e)}")
