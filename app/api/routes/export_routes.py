from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from app.api.deps import get_db
from ledger.attribution_prompt import generate_attribution_prompt
from ledger.export_packets import export_attribution_packet, export_postmortem_packet
from ledger.services import fetch_trades
from ledger.utils import timestamp_to_float

router = APIRouter(prefix="/export")


class AttributionPacketBody(BaseModel):
    trade_id: Optional[str] = None
    decision_id: Optional[str] = None


@router.post("/attribution-packet")
def attribution_packet(body: AttributionPacketBody, conn=Depends(get_db)):
    try:
        markdown = export_attribution_packet(
            conn, trade_id=body.trade_id, decision_id=body.decision_id
        )
        return {"markdown": markdown}
    except (ValueError, Exception) as e:
        raise HTTPException(400, str(e))


@router.post("/postmortem-packet/{decision_id}")
def postmortem_packet(decision_id: str, conn=Depends(get_db)):
    try:
        markdown = export_postmortem_packet(conn, decision_id)
        return {"markdown": markdown}
    except ValueError as e:
        raise HTTPException(404, str(e))


class SheetsBody(BaseModel):
    spreadsheet_id: str
    credentials_path: str


@router.post("/sheets")
def export_sheets(body: SheetsBody, conn=Depends(get_db)):
    try:
        from ledger.sheets_export import export_to_sheets
        counts = export_to_sheets(conn, body.spreadsheet_id, body.credentials_path)
        return counts
    except ImportError:
        raise HTTPException(400, "gspread not installed — run: pip install '.[sheets]'")
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/attribution-prompt")
def attribution_prompt_export(days_back: int = 30, conn=Depends(get_db)):
    trades = fetch_trades(conn)
    if days_back > 0:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days_back)).timestamp()
        trades = [t for t in trades if timestamp_to_float(t["timestamp"]) >= cutoff]
    text = generate_attribution_prompt(trades)
    return {"text": text, "trade_count": len(trades)}
