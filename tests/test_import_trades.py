from __future__ import annotations

import sqlite3

import pytest

from ledger.import_trades import TradeImportValidationError, import_trades_csv


def test_csv_import_deduplicates_repeated_imports(conn, fixture_csv):
    first = import_trades_csv(conn, fixture_csv)
    second = import_trades_csv(conn, fixture_csv)

    assert first.rows_seen == 3
    assert first.rows_imported == 3
    assert first.duplicates_skipped == 0
    assert first.errors == []
    assert second.rows_seen == 3
    assert second.rows_imported == 0
    assert second.duplicates_skipped == 3

    count = conn.execute("SELECT COUNT(*) FROM trades_raw").fetchone()[0]
    assert count == 3


def test_raw_trades_are_immutable(conn, fixture_csv):
    import_trades_csv(conn, fixture_csv)
    trade_id = conn.execute("SELECT trade_id FROM trades_raw LIMIT 1").fetchone()[0]

    with pytest.raises(sqlite3.DatabaseError, match="append-only"):
        conn.execute("UPDATE trades_raw SET price = 0 WHERE trade_id = ?", (trade_id,))

    with pytest.raises(sqlite3.DatabaseError, match="append-only"):
        conn.execute("DELETE FROM trades_raw WHERE trade_id = ?", (trade_id,))


def test_missing_required_columns_raise_clear_error(conn, tmp_path):
    bad_csv = tmp_path / "bad.csv"
    bad_csv.write_text("timestamp,price,shares\n2026-01-01T00:00:00Z,0.5,10\n", encoding="utf-8")

    with pytest.raises(TradeImportValidationError, match="Missing required CSV columns"):
        import_trades_csv(conn, bad_csv)
