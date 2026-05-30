from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.deps import get_db
from ledger.postmortem_battery import battery_to_dict, run_battery
from ledger.services import create_or_update_postmortem, get_postmortems

router = APIRouter(prefix="/postmortems")


@router.get("")
def list_all(conn=Depends(get_db)):
    return get_postmortems(conn)


@router.get("/battery")
def battery(conn=Depends(get_db)):
    return battery_to_dict(run_battery(conn))


class PostmortemBody(BaseModel):
    pnl: Optional[float] = None
    thesis_quality: Optional[str] = None
    execution_quality: Optional[str] = None
    sizing_quality: Optional[str] = None
    exit_quality: Optional[str] = None
    rule_read_quality: Optional[str] = None
    primary_error_type: Optional[str] = None
    secondary_error_type: Optional[str] = None
    what_went_right: Optional[str] = None
    what_went_wrong: Optional[str] = None
    lesson_keep: Optional[str] = None
    lesson_change: Optional[str] = None
    never_repeat: Optional[str] = None
    future_rule: Optional[str] = None
    markdown_body: Optional[str] = None


@router.post("/{decision_id}")
def upsert(decision_id: str, body: PostmortemBody, conn=Depends(get_db)):
    try:
        return create_or_update_postmortem(
            conn, decision_id, **body.model_dump(exclude_none=True)
        )
    except ValueError as e:
        raise HTTPException(404, str(e))
