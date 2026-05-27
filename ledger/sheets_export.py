"""Export ledger tables to a Google Sheets spreadsheet via a service account."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

import gspread
from gspread.exceptions import WorksheetNotFound

from ledger.services import fetch_attributions, fetch_decisions, fetch_trades, get_postmortems

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

_TABLES = ["Trades", "Decisions", "Attributions", "Postmortems"]


def get_client(credentials_path: str | Path) -> gspread.Client:
    return gspread.service_account(filename=str(credentials_path), scopes=_SCOPES)


def export_to_sheets(
    conn: sqlite3.Connection,
    spreadsheet_id: str,
    credentials_path: str | Path,
) -> dict[str, int]:
    """Write all four tables to the spreadsheet. Returns {sheet_name: row_count}.

    Each worksheet is cleared then rewritten from scratch, so this is safe to
    call repeatedly. Worksheets are created if they don't exist yet.
    """
    gc = get_client(credentials_path)
    if spreadsheet_id.startswith("https://"):
        sh = gc.open_by_url(spreadsheet_id)
    else:
        sh = gc.open_by_key(spreadsheet_id)

    tables: dict[str, list[dict[str, Any]]] = {
        "Trades": fetch_trades(conn),
        "Decisions": fetch_decisions(conn),
        "Attributions": fetch_attributions(conn),
        "Postmortems": get_postmortems(conn),
    }

    counts: dict[str, int] = {}
    for name, rows in tables.items():
        ws = _get_or_create_worksheet(sh, name)
        ws.clear()
        if rows:
            headers = list(rows[0].keys())
            values = [headers] + [[_cell(row.get(h)) for h in headers] for row in rows]
            ws.update(values, "A1")
        counts[name] = len(rows)
    return counts


def _get_or_create_worksheet(sh: gspread.Spreadsheet, title: str) -> gspread.Worksheet:
    try:
        return sh.worksheet(title)
    except WorksheetNotFound:
        return sh.add_worksheet(title=title, rows=1000, cols=26)


def _cell(value: Any) -> str:
    if value is None:
        return ""
    return str(value)
