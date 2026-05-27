"""Tests for Google Sheets export. gspread is mocked throughout."""

from __future__ import annotations

from unittest.mock import MagicMock, call, patch

import pytest

from ledger.db import connect_db
from ledger.services import create_decision
from ledger.sheets_export import _TABLES, export_to_sheets


@pytest.fixture
def conn():
    return connect_db(":memory:")


def _make_mocks(worksheet_not_found=False):
    """Return (mock_gc, mock_sh, mock_ws)."""
    from gspread.exceptions import WorksheetNotFound

    mock_ws = MagicMock()
    mock_sh = MagicMock()
    if worksheet_not_found:
        mock_sh.worksheet.side_effect = WorksheetNotFound
        mock_sh.add_worksheet.return_value = mock_ws
    else:
        mock_sh.worksheet.return_value = mock_ws
    mock_gc = MagicMock()
    mock_gc.open_by_key.return_value = mock_sh
    mock_gc.open_by_url.return_value = mock_sh
    return mock_gc, mock_sh, mock_ws


def test_export_empty_db_returns_zero_counts(conn):
    mock_gc, mock_sh, mock_ws = _make_mocks()
    with patch("ledger.sheets_export.gspread.service_account", return_value=mock_gc):
        counts = export_to_sheets(conn, "sheet123", "creds.json")

    assert set(counts.keys()) == set(_TABLES)
    assert all(v == 0 for v in counts.values())


def test_export_uses_open_by_key_for_bare_id(conn):
    mock_gc, mock_sh, _ = _make_mocks()
    with patch("ledger.sheets_export.gspread.service_account", return_value=mock_gc):
        export_to_sheets(conn, "abc123key", "creds.json")

    mock_gc.open_by_key.assert_called_once_with("abc123key")
    mock_gc.open_by_url.assert_not_called()


def test_export_uses_open_by_url_for_https(conn):
    mock_gc, mock_sh, _ = _make_mocks()
    url = "https://docs.google.com/spreadsheets/d/abc123key/edit"
    with patch("ledger.sheets_export.gspread.service_account", return_value=mock_gc):
        export_to_sheets(conn, url, "creds.json")

    mock_gc.open_by_url.assert_called_once_with(url)
    mock_gc.open_by_key.assert_not_called()


def test_export_creates_worksheets_when_missing(conn):
    mock_gc, mock_sh, mock_ws = _make_mocks(worksheet_not_found=True)
    with patch("ledger.sheets_export.gspread.service_account", return_value=mock_gc):
        export_to_sheets(conn, "sheet123", "creds.json")

    assert mock_sh.add_worksheet.call_count == len(_TABLES)
    titles = [c.kwargs["title"] for c in mock_sh.add_worksheet.call_args_list]
    assert titles == _TABLES


def test_export_clears_each_worksheet(conn):
    mock_gc, mock_sh, mock_ws = _make_mocks()
    with patch("ledger.sheets_export.gspread.service_account", return_value=mock_gc):
        export_to_sheets(conn, "sheet123", "creds.json")

    assert mock_ws.clear.call_count == len(_TABLES)


def test_export_writes_headers_and_data_for_decisions(conn):
    create_decision(conn, market_slug="test-market", market_title="Test Market")

    written: list[list] = []

    def capture_update(values, range_name):
        written.append(values)

    mock_gc, mock_sh, mock_ws = _make_mocks()
    mock_ws.update.side_effect = capture_update

    with patch("ledger.sheets_export.gspread.service_account", return_value=mock_gc):
        counts = export_to_sheets(conn, "sheet123", "creds.json")

    assert counts["Decisions"] == 1
    assert len(written) == 1
    headers = written[0][0]
    assert "decision_id" in headers
    assert "market_slug" in headers
    data_row = written[0][1]
    assert "test-market" in data_row


def test_export_does_not_call_update_for_empty_tables(conn):
    mock_gc, mock_sh, mock_ws = _make_mocks()
    with patch("ledger.sheets_export.gspread.service_account", return_value=mock_gc):
        export_to_sheets(conn, "sheet123", "creds.json")

    mock_ws.update.assert_not_called()


def test_export_passes_credentials_path_to_service_account(conn):
    mock_gc, _, _ = _make_mocks()
    with patch("ledger.sheets_export.gspread.service_account", return_value=mock_gc) as mock_sa:
        export_to_sheets(conn, "sheet123", "/home/user/my_creds.json")

    mock_sa.assert_called_once()
    assert mock_sa.call_args.kwargs["filename"] == "/home/user/my_creds.json"
