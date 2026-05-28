import tempfile
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from app.api.deps import get_db
from ledger.import_trades import import_trades_csv
from ledger.transcript_import import import_transcript_text

router = APIRouter(prefix="/import")


@router.post("/csv")
async def import_csv(file: UploadFile = File(...), conn=Depends(get_db)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    try:
        result = import_trades_csv(conn, tmp_path)
        return {
            "rows_seen": result.rows_seen,
            "rows_imported": result.rows_imported,
            "duplicates_skipped": result.duplicates_skipped,
            "non_trade_skipped": result.non_trade_skipped,
            "errors": result.errors,
        }
    except Exception as e:
        raise HTTPException(400, str(e))
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@router.post("/transcript")
async def import_transcript(
    file: UploadFile = File(...),
    assistant: str = Form(...),
    conn=Depends(get_db),
):
    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    fmt = "chatgpt_json" if (file.filename or "").lower().endswith(".json") else "plain"
    try:
        result = import_transcript_text(conn, text, assistant, file.filename or "upload", fmt=fmt)
        return {
            "turns_parsed": result.turns_parsed,
            "assistant_turns": result.assistant_turns,
            "matches_found": result.matches_found,
            "attributions_created": result.attributions_created,
            "duplicates_skipped": result.duplicates_skipped,
            "errors": result.errors,
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
