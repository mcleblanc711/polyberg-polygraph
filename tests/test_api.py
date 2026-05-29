from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_db
from app.api.main import app
from ledger.db import connect_db
from ledger.import_trades import import_trades_csv
from ledger.services import add_assistant_attribution, create_decision, link_trades_to_decision


@pytest.fixture
def api_db_path(tmp_path) -> Path:
    path = tmp_path / "api.sqlite"
    conn = connect_db(path)
    conn.close()
    return path


@pytest.fixture
def client(api_db_path) -> Iterator[TestClient]:
    def override_get_db():
        conn = connect_db(api_db_path, check_same_thread=False)
        try:
            yield conn
        finally:
            conn.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _with_conn(db_path: Path, fn):
    conn = connect_db(db_path)
    try:
        return fn(conn)
    finally:
        conn.close()


def _import_fixture(db_path: Path, fixture_csv):
    def load(conn):
        import_trades_csv(conn, fixture_csv)
        rows = conn.execute("SELECT trade_id FROM trades_raw ORDER BY timestamp").fetchall()
        return [row[0] for row in rows]

    return _with_conn(db_path, load)


def test_trades_linked_filter_accepts_ui_boolean_strings(client, api_db_path, fixture_csv):
    trade_ids = _import_fixture(api_db_path, fixture_csv)

    def arrange(conn):
        decision = create_decision(conn, project="GEO_OIL")
        link_trades_to_decision(conn, [trade_ids[0]], decision["decision_id"])

    _with_conn(api_db_path, arrange)

    linked = client.get("/api/trades?linked=true")
    unlinked = client.get("/api/trades?linked=false")

    assert linked.status_code == 200
    assert unlinked.status_code == 200
    assert [row["trade_id"] for row in linked.json()] == [trade_ids[0]]
    assert {row["trade_id"] for row in unlinked.json()} == set(trade_ids[1:])


def test_trades_include_fields_rendered_by_ledger_screen(client, api_db_path, fixture_csv):
    trade_id = _import_fixture(api_db_path, fixture_csv)[0]

    def arrange(conn):
        decision = create_decision(conn, project="GEO_OIL", sleeve="main")
        link_trades_to_decision(conn, [trade_id], decision["decision_id"])
        add_assistant_attribution(
            conn,
            trade_id=trade_id,
            assistant="GPT",
            attribution="UNCLEAR",
            match_quality=0.5,
            review_status="NEEDS_REVIEW",
        )

    _with_conn(api_db_path, arrange)

    response = client.get(f"/api/trades?market_text={trade_id}")

    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["trade_id"] == trade_id
    assert rows[0]["project"] == "GEO_OIL"
    assert rows[0]["sleeve"] == "main"
    assert rows[0]["linked_projects"] == "GEO_OIL"
    assert rows[0]["linked_sleeves"] == "main"
    assert rows[0]["attr_count"] == 1


def test_link_route_returns_not_found_for_bad_ids(client, api_db_path, fixture_csv):
    trade_id = _import_fixture(api_db_path, fixture_csv)[0]

    response = client.post(
        "/api/trades/link",
        json={"trade_ids": [trade_id], "decision_id": "dec_missing"},
    )

    assert response.status_code == 404
    assert "decision_id not found" in response.text


def test_import_csv_accepts_ui_preview_columns_and_skips_non_trades(client, api_db_path):
    csv_text = (
        "timestamp_utc,condition_id,condition_title,outcome,side,tx_type,price_usdc,shares,notional_usdc,fee_usdc\n"
        "2026-05-22T14:03:11Z,hormuz-normal-end-june-2026,Hormuz remains operationally open,No,BUY,TRADE,0.360,127.789,46.00,0.092\n"
        "2026-05-22T15:03:11Z,hormuz-normal-end-june-2026,Hormuz remains operationally open,USDC,,DEPOSIT,1.000,10,10,0\n"
    )

    response = client.post(
        "/api/import/csv",
        files={"file": ("preview-format.csv", csv_text, "text/csv")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "rows_seen": 2,
        "rows_imported": 1,
        "duplicates_skipped": 0,
        "non_trade_skipped": 1,
        "errors": [],
    }

    def read_row(conn):
        return conn.execute("SELECT * FROM trades_raw").fetchone()

    row = _with_conn(api_db_path, read_row)
    assert row["market_slug"] == "hormuz-normal-end-june-2026"
    assert row["action"] == "TRADE"
    assert row["price"] == 0.36
    assert row["fees"] == 0.092
