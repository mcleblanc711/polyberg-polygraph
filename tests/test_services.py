from __future__ import annotations

import pytest

from ledger.export_packets import export_attribution_packet, export_postmortem_packet
from ledger.grouping import suggest_candidate_groups
from ledger.import_trades import import_trades_csv
from ledger.services import (
    add_assistant_attribution,
    create_decision,
    fetch_unlinked_trades,
    get_attributions_for_decision,
    get_attributions_for_trade,
    get_linked_trades,
    link_trades_to_decision,
    mark_attribution_review_status,
)


def _loaded_trade_ids(conn, fixture_csv):
    import_trades_csv(conn, fixture_csv)
    rows = conn.execute("SELECT trade_id FROM trades_raw ORDER BY timestamp").fetchall()
    return [row[0] for row in rows]


def test_enum_validation_for_decisions(conn):
    with pytest.raises(ValueError, match="project must be one of"):
        create_decision(conn, project="NOT_A_PROJECT")


def test_linking_trades_to_decision(conn, fixture_csv):
    trade_ids = _loaded_trade_ids(conn, fixture_csv)
    decision = create_decision(
        conn,
        project="GEO_OIL",
        market_slug="oil-hormuz-may",
        outcome="Yes",
        side="BUY",
    )

    link_trades_to_decision(conn, trade_ids[:2], decision["decision_id"], 0.9, "USER")
    linked = get_linked_trades(conn, decision["decision_id"])
    unlinked = fetch_unlinked_trades(conn)

    assert [row["trade_id"] for row in linked] == trade_ids[:2]
    assert len(unlinked) == 1


def test_assistant_attribution_validation(conn, fixture_csv):
    trade_id = _loaded_trade_ids(conn, fixture_csv)[0]
    decision = create_decision(conn, project="GEO_OIL")

    with pytest.raises(ValueError, match="must reference trade_id or decision_id"):
        add_assistant_attribution(
            conn,
            assistant="GPT",
            attribution="UNCLEAR",
            match_quality=0.5,
            review_status="DRAFT",
        )

    with pytest.raises(ValueError, match="assistant must be one of"):
        add_assistant_attribution(
            conn,
            trade_id=trade_id,
            assistant="BARD",
            attribution="UNCLEAR",
            match_quality=0.5,
            review_status="DRAFT",
        )

    with pytest.raises(ValueError, match="match_quality must be between 0 and 1"):
        add_assistant_attribution(
            conn,
            decision_id=decision["decision_id"],
            assistant="CLAUDE",
            attribution="UNCLEAR",
            match_quality=2,
            review_status="DRAFT",
        )

    added = add_assistant_attribution(
        conn,
        trade_id=trade_id,
        decision_id=decision["decision_id"],
        assistant="GPT",
        attribution="SUPPORTED_AFTER_REVIEW",
        evidence="Transcript mentions the same trade thesis.",
        evidence_source="chat_export.md",
        match_quality=0.8,
        review_status="MODEL_PROPOSED",
    )
    updated = mark_attribution_review_status(conn, added["attribution_id"], "USER_CONFIRMED")

    assert updated["review_status"] == "USER_CONFIRMED"
    assert len(get_attributions_for_trade(conn, trade_id)) == 1
    assert len(get_attributions_for_decision(conn, decision["decision_id"])) == 1


def test_grouping_suggests_but_does_not_link(conn, fixture_csv):
    _loaded_trade_ids(conn, fixture_csv)
    unlinked = fetch_unlinked_trades(conn)

    suggestions = suggest_candidate_groups(unlinked)

    assert len(suggestions) == 1
    assert suggestions[0]["confidence"] > 0
    assert len(fetch_unlinked_trades(conn)) == 3


def test_attribution_packet_contains_required_fields(conn, fixture_csv):
    trade_id = _loaded_trade_ids(conn, fixture_csv)[0]
    decision = create_decision(conn, project="GEO_OIL", market_slug="oil-hormuz-may")
    link_trades_to_decision(conn, [trade_id], decision["decision_id"])

    packet = export_attribution_packet(conn, trade_id=trade_id, decision_id=decision["decision_id"])

    assert "# Assistant Attribution Review Packet" in packet
    assert "Allowed attribution values" in packet
    assert "required" not in packet.lower()
    assert '"assistant"' in packet
    assert '"attribution"' in packet
    assert '"evidence_source"' in packet
    assert '"recommended_price"' in packet
    assert '"recommended_size"' in packet
    assert '"match_quality"' in packet
    assert '"review_status"' in packet
    assert '"notes"' in packet


def test_postmortem_packet_contains_required_fields(conn, fixture_csv):
    trade_id = _loaded_trade_ids(conn, fixture_csv)[0]
    decision = create_decision(
        conn,
        project="GEO_OIL",
        thesis_summary="Rule read and catalyst thesis.",
    )
    link_trades_to_decision(conn, [trade_id], decision["decision_id"])

    packet = export_postmortem_packet(conn, decision["decision_id"])

    assert "# Post-Mortem Packet" in packet
    assert "## Decision Details" in packet
    assert "## Linked Trades" in packet
    assert "## Current Attribution Summary" in packet
    for field in [
        "thesis_quality",
        "execution_quality",
        "sizing_quality",
        "exit_quality",
        "rule_read_quality",
        "primary_error_type",
        "secondary_error_type",
        "what_went_right",
        "what_went_wrong",
        "lesson_keep",
        "lesson_change",
        "never_repeat",
        "future_rule",
    ]:
        assert field in packet
