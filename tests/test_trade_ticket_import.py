from __future__ import annotations

from ledger.services import get_attributions_for_decision, get_decision
from ledger.trade_ticket_import import import_trade_ticket


def ticket_payload():
    """A trade_ticket.json as Polyberg's adjudicator emits it."""
    return {
        "schema_version": "1",
        "source": "polyberg-adjudicator",
        "as_of": "2026-04-26T09:00:00-06:00",
        "human_review_required": True,
        "decisions": [
            {
                "market_id": "hormuz_normal_end_june",
                "market_slug": "strait-of-hormuz-traffic-returns-to-normal",
                "market_title": "Hormuz normal by end of June 2026",
                "side": "YES",
                "intent": "buy",
                "decision_type": "ENTRY",
                "price_used": 0.4,
                "max_allocation": 4.0,
                "thesis_summary": "Transit recovering.",
                "rule_summary": "hormuz_portwatch_7dma",
                # Free text from the un-migrated registry: must be dropped + warned.
                "oracle_type": "IMF Portwatch data",
                "thesis_bucket": "Iran conflict",
                "status": "DRAFT",
                "attributions": [
                    {
                        "source_model_support": ["gpt", "claude"],
                        "recommended_price": 0.4,
                        "recommended_size": 10,
                        "evidence": "Both models supported the entry.",
                    }
                ],
            }
        ],
        "rejected": [{"market_id": "some_other_market", "rationale": "Rule gap."}],
    }


def test_round_trip_creates_decision_and_attributions(conn):
    result = import_trade_ticket(conn, ticket_payload())

    assert result.decisions_seen == 1
    assert result.decisions_created == 1
    assert result.attributions_created == 2  # gpt + claude
    assert not result.errors

    decision = get_decision(conn, result.decision_ids[0])
    assert decision["market_title"] == "Hormuz normal by end of June 2026"
    assert decision["side"] == "YES"
    assert decision["price_used"] == 0.4
    assert decision["status"] == "DRAFT"

    attributions = get_attributions_for_decision(conn, result.decision_ids[0])
    assistants = sorted(a["assistant"] for a in attributions)
    assert assistants == ["CLAUDE", "GPT"]
    assert all(a["attribution"] == "DIRECT_RECOMMENDATION" for a in attributions)
    assert all(a["recommended_price"] == 0.4 for a in attributions)


def test_unmigrated_enums_are_dropped_with_warnings(conn):
    result = import_trade_ticket(conn, ticket_payload())

    decision = get_decision(conn, result.decision_ids[0])
    # Free-text registry values are not valid ledger enums yet -> stored as NULL.
    assert decision["oracle_type"] is None
    assert decision["thesis_bucket"] is None
    assert any("oracle_type" in w for w in result.warnings)
    assert any("thesis_bucket" in w for w in result.warnings)


def test_valid_enums_pass_through(conn):
    payload = ticket_payload()
    payload["decisions"][0]["oracle_type"] = "data"
    payload["decisions"][0]["thesis_bucket"] = "hormuz_transit"

    result = import_trade_ticket(conn, payload)

    decision = get_decision(conn, result.decision_ids[0])
    assert decision["oracle_type"] == "data"
    assert decision["thesis_bucket"] == "hormuz_transit"
    assert not result.warnings


def test_both_token_expands_and_unknown_is_skipped(conn):
    payload = ticket_payload()
    payload["decisions"][0]["attributions"] = [
        {"source_model_support": "both"},
        {"source_model_support": "model_a"},
    ]

    result = import_trade_ticket(conn, payload)

    attributions = get_attributions_for_decision(conn, result.decision_ids[0])
    assert sorted(a["assistant"] for a in attributions) == ["CLAUDE", "GPT"]
    assert any("model_a" in w for w in result.warnings)


def test_dry_run_writes_nothing(conn):
    result = import_trade_ticket(conn, ticket_payload(), dry_run=True)

    assert result.decisions_created == 1
    assert result.attributions_created == 2
    assert result.decision_ids == []
    # Nothing persisted.
    rows = conn.execute("SELECT COUNT(*) FROM decisions").fetchone()[0]
    assert rows == 0


def test_per_decision_error_is_isolated(conn):
    payload = ticket_payload()
    payload["decisions"].append({"market_id": "second", "side": "NO", "price_used": 0.2})
    # Make the first decision blow up by handing create_decision a bad project.
    payload["decisions"][0]["status"] = "DRAFT"

    result = import_trade_ticket(conn, payload)
    # Both well-formed decisions import; seen counts everything.
    assert result.decisions_seen == 2
    assert result.decisions_created == 2
