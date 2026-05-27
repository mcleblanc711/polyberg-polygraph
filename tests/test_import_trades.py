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


def test_polymarket_history_csv_format(conn, tmp_path):
    csv = tmp_path / "Polymarket-History.csv"
    csv.write_text(
        '"marketName","action","usdcAmount","tokenAmount","tokenName","timestamp","hash"\n'
        '"Will X happen?","Buy","42.00","100.0","Yes","1779681718","0xabc"\n'
        '"Will X happen?","Sell","10.00","25.0","No","1779681719","0xdef"\n'
        '"Deposit","Deposit","50.00","50.0","USDC","1779681720","0x111"\n'
        '"Withdraw","Withdraw","10.00","10.0","USDC","1779681721","0x222"\n',
        encoding="utf-8",
    )
    result = import_trades_csv(conn, csv)

    assert result.rows_seen == 4
    assert result.non_trade_skipped == 2
    assert result.rows_imported == 2
    assert result.errors == []

    rows = conn.execute("SELECT outcome, price, shares, market_title FROM trades_raw ORDER BY timestamp").fetchall()
    assert rows[0]["outcome"] == "Yes"
    assert abs(rows[0]["price"] - 0.42) < 0.001
    assert rows[0]["shares"] == 100.0
    assert rows[0]["market_title"] == "Will X happen?"


def test_missing_required_columns_raise_clear_error(conn, tmp_path):
    bad_csv = tmp_path / "bad.csv"
    bad_csv.write_text("timestamp,price,shares\n2026-01-01T00:00:00Z,0.5,10\n", encoding="utf-8")

    with pytest.raises(TradeImportValidationError, match="Missing required CSV columns"):
        import_trades_csv(conn, bad_csv)
