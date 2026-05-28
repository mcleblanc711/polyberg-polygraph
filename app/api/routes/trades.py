from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.api.deps import get_db
from ledger.grouping import suggest_candidate_groups
from ledger.services import fetch_trades, fetch_unlinked_trades, link_trades_to_decision

router = APIRouter(prefix="/trades")


@router.get("")
def list_trades(
    project: Optional[str] = None,
    market_text: Optional[str] = None,
    outcome: Optional[str] = None,
    side: Optional[str] = None,
    action: Optional[str] = None,
    linked: Optional[bool] = None,
    conn=Depends(get_db),
):
    return fetch_trades(
        conn,
        project=project or None,
        market_text=market_text or None,
        outcome=outcome or None,
        side=side or None,
        action=action or None,
        linked=linked,
    )


@router.get("/unlinked")
def list_unlinked(conn=Depends(get_db)):
    return fetch_unlinked_trades(conn)


@router.get("/groups")
def suggested_groups(conn=Depends(get_db)):
    unlinked = fetch_unlinked_trades(conn)
    return suggest_candidate_groups(unlinked)


class LinkBody(BaseModel):
    trade_ids: list[str]
    decision_id: str
    link_confidence: float = 1.0
    link_method: str = "USER"


@router.post("/link")
def link(body: LinkBody, conn=Depends(get_db)):
    link_trades_to_decision(
        conn, body.trade_ids, body.decision_id, body.link_confidence, body.link_method
    )
    return {"ok": True, "linked": len(body.trade_ids)}
