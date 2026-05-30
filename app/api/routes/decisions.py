from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.deps import get_db
from ledger.services import (
    create_decision,
    edit_decision,
    fetch_decisions,
    get_decision,
    get_linked_trades,
)

router = APIRouter(prefix="/decisions")


@router.get("")
def list_decisions(conn=Depends(get_db)):
    return fetch_decisions(conn)


@router.get("/{decision_id}")
def get_one(decision_id: str, conn=Depends(get_db)):
    try:
        return get_decision(conn, decision_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/{decision_id}/trades")
def linked_trades(decision_id: str, conn=Depends(get_db)):
    try:
        return get_linked_trades(conn, decision_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


class CreateDecisionBody(BaseModel):
    project: Optional[str] = None
    sleeve: Optional[str] = None
    market_slug: Optional[str] = None
    market_title: Optional[str] = None
    outcome: Optional[str] = None
    side: Optional[str] = None
    intent: Optional[str] = None
    decision_type: Optional[str] = None
    price_used: Optional[float] = None
    target_entry: Optional[str] = None
    target_exit: Optional[str] = None
    max_allocation: Optional[float] = None
    thesis_summary: Optional[str] = None
    rule_summary: Optional[str] = None
    catalyst: Optional[str] = None
    invalidation: Optional[str] = None
    user_notes: Optional[str] = None
    status: Optional[str] = None
    oracle_type: Optional[str] = None
    thesis_bucket: Optional[str] = None
    exit_reason: Optional[str] = None


@router.post("")
def create(body: CreateDecisionBody, conn=Depends(get_db)):
    try:
        return create_decision(conn, **body.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(400, str(e))


class EditDecisionBody(BaseModel):
    status: Optional[str] = None
    user_notes: Optional[str] = None
    thesis_summary: Optional[str] = None
    rule_summary: Optional[str] = None
    catalyst: Optional[str] = None
    invalidation: Optional[str] = None
    sleeve: Optional[str] = None
    oracle_type: Optional[str] = None
    thesis_bucket: Optional[str] = None
    exit_reason: Optional[str] = None


@router.patch("/{decision_id}")
def edit(decision_id: str, body: EditDecisionBody, conn=Depends(get_db)):
    try:
        return edit_decision(conn, decision_id, **body.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(404, str(e))
