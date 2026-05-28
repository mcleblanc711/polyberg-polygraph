from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.deps import get_db
from ledger.services import (
    add_assistant_attribution,
    fetch_attributions,
    get_attributions_for_decision,
    get_attributions_for_trade,
    mark_attribution_review_status,
)

router = APIRouter(prefix="/attributions")


@router.get("")
def list_all(conn=Depends(get_db)):
    return fetch_attributions(conn)


@router.get("/trade/{trade_id}")
def by_trade(trade_id: str, conn=Depends(get_db)):
    try:
        return get_attributions_for_trade(conn, trade_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/decision/{decision_id}")
def by_decision(decision_id: str, conn=Depends(get_db)):
    try:
        return get_attributions_for_decision(conn, decision_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


class AddAttributionBody(BaseModel):
    trade_id: Optional[str] = None
    decision_id: Optional[str] = None
    assistant: str
    attribution: str
    evidence: Optional[str] = None
    evidence_source: Optional[str] = None
    recommended_price: Optional[float] = None
    recommended_size: Optional[float] = None
    match_quality: float = 0.0
    review_status: str = "DRAFT"


@router.post("")
def add(body: AddAttributionBody, conn=Depends(get_db)):
    try:
        return add_assistant_attribution(conn, **body.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(400, str(e))


class ReviewStatusBody(BaseModel):
    review_status: str


@router.patch("/{attribution_id}/review-status")
def update_review_status(attribution_id: str, body: ReviewStatusBody, conn=Depends(get_db)):
    try:
        return mark_attribution_review_status(conn, attribution_id, body.review_status)
    except ValueError as e:
        raise HTTPException(400, str(e))
