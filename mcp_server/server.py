"""MCP tools for the Polygraph ledger (read + write)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

from ledger.db import connect_db
from ledger.export_packets import export_attribution_packet, export_postmortem_packet
from ledger.services import (
    add_assistant_attribution,
    create_decision as svc_create_decision,
    fetch_decisions,
    fetch_trades,
    fetch_unlinked_trades,
    get_attributions_for_decision,
    get_attributions_for_trade,
    get_decision,
    get_linked_trades,
    get_trade,
    link_trades_to_decision as svc_link_trades,
    mark_attribution_review_status,
)

_PROJECT_ROOT = Path(__file__).parent.parent
_DB_PATH = _PROJECT_ROOT / "data" / "processed" / "polygraph.sqlite"

mcp = FastMCP("Polygraph")
_conn = connect_db(_DB_PATH)


def _j(value: Any) -> str:
    return json.dumps(value, default=str, indent=2)


@mcp.tool()
def list_trades(
    project: str | None = None,
    market_text: str | None = None,
    outcome: str | None = None,
    side: str | None = None,
    action: str | None = None,
    linked: bool | None = None,
) -> str:
    """List trades from the ledger. All filters are optional.

    linked=true returns only linked trades; linked=false returns only unlinked ones.
    market_text matches against market_slug and market_title (case-insensitive substring).
    """
    return _j(fetch_trades(_conn, project=project, market_text=market_text,
                           outcome=outcome, side=side, action=action, linked=linked))


@mcp.tool()
def get_trade_by_id(trade_id: str) -> str:
    """Get a single trade by its trade_id (e.g. trd_abc123...)."""
    return _j(get_trade(_conn, trade_id))


@mcp.tool()
def list_decisions(project: str | None = None) -> str:
    """List all decisions, optionally filtered by project.

    Valid projects: GEO_OIL, ELECTIONS, SPORTS_MM, SPORTS_DIRECTIONAL, EXPERIMENTAL, CASH.
    """
    decisions = fetch_decisions(_conn)
    if project:
        decisions = [d for d in decisions if d.get("project") == project]
    return _j(decisions)


@mcp.tool()
def get_decision_by_id(decision_id: str) -> str:
    """Get a single decision by its decision_id (e.g. dec_abc123...)."""
    return _j(get_decision(_conn, decision_id))


@mcp.tool()
def get_linked_trades_for_decision(decision_id: str) -> str:
    """Get all trades linked to a given decision, with link metadata."""
    return _j(get_linked_trades(_conn, decision_id))


@mcp.tool()
def list_unlinked_trades() -> str:
    """List all trades not yet linked to any decision."""
    return _j(fetch_unlinked_trades(_conn))


@mcp.tool()
def get_trade_attributions(trade_id: str) -> str:
    """Get all assistant attributions recorded for a trade."""
    return _j(get_attributions_for_trade(_conn, trade_id))


@mcp.tool()
def get_decision_attributions(decision_id: str) -> str:
    """Get all assistant attributions recorded for a decision."""
    return _j(get_attributions_for_decision(_conn, decision_id))


@mcp.tool()
def generate_attribution_packet(
    trade_id: str | None = None,
    decision_id: str | None = None,
) -> str:
    """Generate a markdown attribution review packet for a trade or decision.

    At least one of trade_id or decision_id must be provided.
    The packet includes trade/decision details, linked fills, existing attributions,
    and instructions for producing a structured attribution JSON.
    """
    return export_attribution_packet(_conn, trade_id=trade_id, decision_id=decision_id)


@mcp.tool()
def generate_postmortem_packet(decision_id: str) -> str:
    """Generate a markdown post-mortem packet for a decision.

    Includes decision details, linked trades, attribution summary, and post-mortem fields.
    """
    return export_postmortem_packet(_conn, decision_id)


# ── Write tools ────────────────────────────────────────────────────────────────

@mcp.tool()
def list_pending_attributions() -> str:
    """List all attributions with review_status = NEEDS_REVIEW.

    These are typically created by transcript import and need user confirmation.
    Use confirm_attribution to approve (USER_CONFIRMED) or reject (REJECTED) each one.
    """
    rows = _conn.execute(
        "SELECT * FROM assistant_attributions WHERE review_status = 'NEEDS_REVIEW' ORDER BY created_at DESC"
    ).fetchall()
    return _j([dict(r) for r in rows])


@mcp.tool()
def confirm_attribution(attribution_id: str, review_status: str) -> str:
    """Update the review_status of an attribution.

    Use this to approve or reject NEEDS_REVIEW attributions created by transcript import.
    Valid statuses: DRAFT, MODEL_PROPOSED, USER_CONFIRMED, REJECTED, NEEDS_REVIEW.
    Returns the updated attribution record.
    """
    return _j(mark_attribution_review_status(_conn, attribution_id, review_status))


@mcp.tool()
def add_attribution(
    assistant: str,
    attribution: str,
    trade_id: str | None = None,
    decision_id: str | None = None,
    evidence: str | None = None,
    evidence_source: str | None = None,
    recommended_price: float | None = None,
    recommended_size: float | None = None,
    match_quality: float = 0.0,
    review_status: str = "MODEL_PROPOSED",
) -> str:
    """Add an assistant attribution for a trade or decision.

    At least one of trade_id or decision_id must be provided; both is allowed.
    assistant: GPT, CLAUDE, GROK, or USER.
    attribution: DIRECT_RECOMMENDATION, SUPPORTED_AFTER_REVIEW, OPPOSED,
                 MENTIONED_BUT_NOT_RECOMMENDED, NO_MATCH_FOUND, NOT_INVOLVED, UNCLEAR.
    match_quality: 0.0–1.0 confidence that this assistant influenced the trade.
    review_status defaults to MODEL_PROPOSED since this tool is typically called by an AI.
    Returns the created attribution record including its attribution_id.
    """
    return _j(add_assistant_attribution(
        _conn,
        trade_id=trade_id,
        decision_id=decision_id,
        assistant=assistant,
        attribution=attribution,
        evidence=evidence,
        evidence_source=evidence_source,
        recommended_price=recommended_price,
        recommended_size=recommended_size,
        match_quality=match_quality,
        review_status=review_status,
    ))


@mcp.tool()
def create_decision(
    project: str,
    market_slug: str | None = None,
    market_title: str | None = None,
    outcome: str | None = None,
    side: str | None = None,
    intent: str | None = None,
    decision_type: str | None = None,
    price_used: float | None = None,
    thesis_summary: str | None = None,
    rule_summary: str | None = None,
    catalyst: str | None = None,
    invalidation: str | None = None,
    user_notes: str | None = None,
) -> str:
    """Create a new trading decision record.

    project is required: GEO_OIL, ELECTIONS, SPORTS_MM, SPORTS_DIRECTIONAL, EXPERIMENTAL, CASH.
    Returns the created decision including its decision_id, which you can use to
    link trades with link_trades_to_decision.
    """
    return _j(svc_create_decision(
        _conn,
        project=project,
        market_slug=market_slug,
        market_title=market_title,
        outcome=outcome,
        side=side,
        intent=intent,
        decision_type=decision_type,
        price_used=price_used,
        thesis_summary=thesis_summary,
        rule_summary=rule_summary,
        catalyst=catalyst,
        invalidation=invalidation,
        user_notes=user_notes,
    ))


@mcp.tool()
def link_trades_to_decision(
    trade_ids: list[str],
    decision_id: str,
    link_confidence: float = 1.0,
) -> str:
    """Link one or more trades to a decision.

    trade_ids: list of trade_id strings (e.g. ["trd_abc123", "trd_def456"]).
    link_confidence: 0.0–1.0, use lower values when the link is inferred rather than certain.
    Idempotent — relinking the same (trade_id, decision_id) pair is a no-op.
    Returns a confirmation with the decision and number of trades linked.
    """
    svc_link_trades(_conn, trade_ids, decision_id, link_confidence, "MCP")
    decision = get_decision(_conn, decision_id)
    linked = get_linked_trades(_conn, decision_id)
    return _j({"decision": decision, "linked_trade_count": len(linked), "linked_trade_ids": [t["trade_id"] for t in linked]})


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
