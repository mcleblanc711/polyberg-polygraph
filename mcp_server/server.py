"""MCP read-only tools for the Polygraph ledger."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

from ledger.db import connect_db
from ledger.export_packets import export_attribution_packet, export_postmortem_packet
from ledger.services import (
    fetch_decisions,
    fetch_trades,
    fetch_unlinked_trades,
    get_attributions_for_decision,
    get_attributions_for_trade,
    get_decision,
    get_linked_trades,
    get_trade,
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


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
