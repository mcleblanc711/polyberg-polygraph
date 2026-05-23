"""Markdown packet exports for assistant review and post-mortems."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from ledger.enums import ASSISTANTS, ATTRIBUTIONS, REVIEW_STATUSES
from ledger.services import (
    get_attributions_for_decision,
    get_attributions_for_trade,
    get_decision,
    get_linked_trades,
    get_trade,
)


def export_attribution_packet(
    conn: sqlite3.Connection, trade_id: str | None = None, decision_id: str | None = None
) -> str:
    if not trade_id and not decision_id:
        raise ValueError("trade_id or decision_id is required")
    lines = ["# Assistant Attribution Review Packet", ""]

    if trade_id:
        trade = get_trade(conn, trade_id)
        lines.extend(["## Trade", _format_dict(trade), ""])
        attributions = get_attributions_for_trade(conn, trade_id)
    else:
        attributions = []

    if decision_id:
        decision = get_decision(conn, decision_id)
        linked = get_linked_trades(conn, decision_id)
        lines.extend(["## Decision", _format_dict(decision), ""])
        lines.extend(["## Linked Fills", _format_list(linked), ""])
        attributions.extend(get_attributions_for_decision(conn, decision_id))

    lines.extend(["## Current Attributions", _format_list(attributions), ""])
    lines.extend(
        [
            "## Instructions",
            "Choose exactly one allowed attribution value. Base the answer only on supplied trade, decision, and evidence context.",
            "",
            f"Allowed assistants: {', '.join(sorted(ASSISTANTS))}",
            f"Allowed attribution values: {', '.join(sorted(ATTRIBUTIONS))}",
            f"Allowed review_status values: {', '.join(sorted(REVIEW_STATUSES))}",
            "",
            "Return JSON only using this schema:",
            "```json",
            json.dumps(
                {
                    "assistant": "GPT|CLAUDE|GROK|USER",
                    "attribution": "DIRECT_RECOMMENDATION|SUPPORTED_AFTER_REVIEW|OPPOSED|MENTIONED_BUT_NOT_RECOMMENDED|NO_MATCH_FOUND|NOT_INVOLVED|UNCLEAR",
                    "evidence": "string",
                    "evidence_source": "string",
                    "recommended_price": None,
                    "recommended_size": None,
                    "match_quality": 0.0,
                    "review_status": "MODEL_PROPOSED",
                    "notes": "string",
                },
                indent=2,
            ),
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def export_postmortem_packet(conn: sqlite3.Connection, decision_id: str) -> str:
    decision = get_decision(conn, decision_id)
    linked = get_linked_trades(conn, decision_id)
    attributions = get_attributions_for_decision(conn, decision_id)
    lines = [
        "# Post-Mortem Packet",
        "",
        "## Decision Details",
        _format_dict(decision),
        "",
        "## Linked Trades",
        _format_list(linked),
        "",
        "## Current Attribution Summary",
        _format_list(attributions),
        "",
        "## Post-Mortem Fields",
        "- thesis_quality:",
        "- execution_quality:",
        "- sizing_quality:",
        "- exit_quality:",
        "- rule_read_quality:",
        "- primary_error_type:",
        "- secondary_error_type:",
        "- what_went_right:",
        "- what_went_wrong:",
        "- lesson_keep:",
        "- lesson_change:",
        "- never_repeat:",
        "- future_rule:",
        "",
    ]
    return "\n".join(lines)


def save_packet(markdown: str, output_dir: str | Path, filename: str) -> Path:
    path = Path(output_dir)
    path.mkdir(parents=True, exist_ok=True)
    destination = path / filename
    destination.write_text(markdown, encoding="utf-8")
    return destination


def _format_dict(value: dict[str, Any]) -> str:
    if not value:
        return "_None_"
    return "\n".join(f"- {key}: {'' if val is None else val}" for key, val in value.items())


def _format_list(values: list[dict[str, Any]]) -> str:
    if not values:
        return "_None_"
    chunks = []
    for item in values:
        chunks.append("\n".join(f"- {key}: {'' if val is None else val}" for key, val in item.items()))
    return "\n\n".join(chunks)
