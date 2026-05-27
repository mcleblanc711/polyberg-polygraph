"""Service functions used by tests, Streamlit, and future MCP wrappers."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

from ledger.enums import ASSISTANTS, ATTRIBUTIONS, PROJECTS, REVIEW_STATUSES, validate_choice
from ledger.models import row_to_dict, rows_to_dicts


DECISION_FIELDS = {
    "decision_timestamp",
    "project",
    "sleeve",
    "market_slug",
    "market_title",
    "outcome",
    "side",
    "intent",
    "decision_type",
    "price_used",
    "target_entry",
    "target_exit",
    "max_allocation",
    "thesis_summary",
    "rule_summary",
    "catalyst",
    "invalidation",
    "user_notes",
    "status",
}

POSTMORTEM_FIELDS = {
    "pnl",
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
    "markdown_body",
}


def create_decision(conn: sqlite3.Connection, **fields: Any) -> dict[str, Any]:
    project = validate_choice(fields.get("project", "EXPERIMENTAL"), PROJECTS, "project")
    decision_id = fields.get("decision_id") or f"dec_{uuid.uuid4().hex[:16]}"
    values = {field: fields.get(field) for field in DECISION_FIELDS}
    values["decision_id"] = decision_id
    values["decision_timestamp"] = values["decision_timestamp"] or _now_iso()
    values["project"] = project
    values["status"] = values["status"] or "DRAFT"

    with conn:
        conn.execute(
            """
            INSERT INTO decisions (
                decision_id, decision_timestamp, project, sleeve, market_slug, market_title,
                outcome, side, intent, decision_type, price_used, target_entry, target_exit,
                max_allocation, thesis_summary, rule_summary, catalyst, invalidation,
                user_notes, status
            ) VALUES (
                :decision_id, :decision_timestamp, :project, :sleeve, :market_slug, :market_title,
                :outcome, :side, :intent, :decision_type, :price_used, :target_entry, :target_exit,
                :max_allocation, :thesis_summary, :rule_summary, :catalyst, :invalidation,
                :user_notes, :status
            )
            """,
            values,
        )
    return get_decision(conn, decision_id)


def edit_decision(conn: sqlite3.Connection, decision_id: str, **updates: Any) -> dict[str, Any]:
    _require_decision(conn, decision_id)
    clean_updates = {k: v for k, v in updates.items() if k in DECISION_FIELDS}
    if "project" in clean_updates and clean_updates["project"]:
        validate_choice(clean_updates["project"], PROJECTS, "project")
    if not clean_updates:
        return get_decision(conn, decision_id)

    assignments = ", ".join(f"{field} = :{field}" for field in clean_updates)
    clean_updates["decision_id"] = decision_id
    with conn:
        conn.execute(f"UPDATE decisions SET {assignments} WHERE decision_id = :decision_id", clean_updates)
    return get_decision(conn, decision_id)


def get_decision(conn: sqlite3.Connection, decision_id: str) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM decisions WHERE decision_id = ?", (decision_id,)).fetchone()
    if row is None:
        raise ValueError(f"decision_id not found: {decision_id}")
    return dict(row)


def fetch_decisions(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT * FROM decisions ORDER BY decision_timestamp DESC").fetchall()
    return rows_to_dicts(rows)


def fetch_attributions(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM assistant_attributions ORDER BY created_at DESC"
    ).fetchall()
    return rows_to_dicts(rows)


def fetch_trades(
    conn: sqlite3.Connection,
    project: str | None = None,
    market_text: str | None = None,
    outcome: str | None = None,
    side: str | None = None,
    action: str | None = None,
    linked: bool | None = None,
) -> list[dict[str, Any]]:
    query = [
        """
        SELECT t.*,
               CASE WHEN COUNT(l.decision_id) > 0 THEN 1 ELSE 0 END AS is_linked,
               GROUP_CONCAT(DISTINCT d.project) AS linked_projects,
               GROUP_CONCAT(DISTINCT d.decision_id) AS linked_decision_ids
        FROM trades_raw t
        LEFT JOIN trade_decision_links l ON l.trade_id = t.trade_id
        LEFT JOIN decisions d ON d.decision_id = l.decision_id
        """
    ]
    where = []
    params: list[Any] = []
    if project:
        where.append("d.project = ?")
        params.append(project)
    if market_text:
        where.append("(t.market_slug LIKE ? OR t.market_title LIKE ?)")
        needle = f"%{market_text}%"
        params.extend([needle, needle])
    if outcome:
        where.append("t.outcome = ?")
        params.append(outcome)
    if side:
        where.append("t.side = ?")
        params.append(side)
    if action:
        where.append("t.action = ?")
        params.append(action)
    if where:
        query.append(" WHERE " + " AND ".join(where))
    query.append(" GROUP BY t.trade_id")
    if linked is True:
        query.append(" HAVING COUNT(l.decision_id) > 0")
    elif linked is False:
        query.append(" HAVING COUNT(l.decision_id) = 0")
    query.append(" ORDER BY t.timestamp DESC")
    return rows_to_dicts(conn.execute("".join(query), params).fetchall())


def link_trades_to_decision(
    conn: sqlite3.Connection,
    trade_ids: list[str],
    decision_id: str,
    link_confidence: float = 1.0,
    link_method: str = "USER",
) -> None:
    _require_decision(conn, decision_id)
    if not 0 <= link_confidence <= 1:
        raise ValueError("link_confidence must be between 0 and 1")
    created_at = _now_iso()
    with conn:
        for trade_id in trade_ids:
            _require_trade(conn, trade_id)
            conn.execute(
                """
                INSERT OR IGNORE INTO trade_decision_links (
                    trade_id, decision_id, link_confidence, link_method, created_at
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (trade_id, decision_id, link_confidence, link_method, created_at),
            )


def get_linked_trades(conn: sqlite3.Connection, decision_id: str) -> list[dict[str, Any]]:
    _require_decision(conn, decision_id)
    rows = conn.execute(
        """
        SELECT t.*, l.link_confidence, l.link_method, l.created_at AS linked_at
        FROM trade_decision_links l
        JOIN trades_raw t ON t.trade_id = l.trade_id
        WHERE l.decision_id = ?
        ORDER BY t.timestamp
        """,
        (decision_id,),
    ).fetchall()
    return rows_to_dicts(rows)


def fetch_unlinked_trades(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return fetch_trades(conn, linked=False)


def add_assistant_attribution(conn: sqlite3.Connection, **fields: Any) -> dict[str, Any]:
    trade_id = fields.get("trade_id")
    decision_id = fields.get("decision_id")
    if not trade_id and not decision_id:
        raise ValueError("assistant attribution must reference trade_id or decision_id")
    if trade_id:
        _require_trade(conn, trade_id)
    if decision_id:
        _require_decision(conn, decision_id)

    assistant = validate_choice(fields["assistant"], ASSISTANTS, "assistant")
    attribution = validate_choice(fields["attribution"], ATTRIBUTIONS, "attribution")
    review_status = validate_choice(
        fields.get("review_status", "DRAFT"), REVIEW_STATUSES, "review_status"
    )
    match_quality = float(fields.get("match_quality", 0))
    if not 0 <= match_quality <= 1:
        raise ValueError("match_quality must be between 0 and 1")

    attribution_id = fields.get("attribution_id") or f"att_{uuid.uuid4().hex[:16]}"
    values = {
        "attribution_id": attribution_id,
        "trade_id": trade_id,
        "decision_id": decision_id,
        "assistant": assistant,
        "attribution": attribution,
        "evidence": fields.get("evidence"),
        "evidence_source": fields.get("evidence_source"),
        "recommended_price": fields.get("recommended_price"),
        "recommended_size": fields.get("recommended_size"),
        "match_quality": match_quality,
        "review_status": review_status,
        "created_at": _now_iso(),
    }
    with conn:
        conn.execute(
            """
            INSERT INTO assistant_attributions (
                attribution_id, trade_id, decision_id, assistant, attribution, evidence,
                evidence_source, recommended_price, recommended_size, match_quality,
                review_status, created_at
            ) VALUES (
                :attribution_id, :trade_id, :decision_id, :assistant, :attribution, :evidence,
                :evidence_source, :recommended_price, :recommended_size, :match_quality,
                :review_status, :created_at
            )
            """,
            values,
        )
    return _get_attribution(conn, attribution_id)


def get_attributions_for_trade(conn: sqlite3.Connection, trade_id: str) -> list[dict[str, Any]]:
    _require_trade(conn, trade_id)
    rows = conn.execute(
        "SELECT * FROM assistant_attributions WHERE trade_id = ? ORDER BY created_at DESC",
        (trade_id,),
    ).fetchall()
    return rows_to_dicts(rows)


def get_attributions_for_decision(conn: sqlite3.Connection, decision_id: str) -> list[dict[str, Any]]:
    _require_decision(conn, decision_id)
    rows = conn.execute(
        "SELECT * FROM assistant_attributions WHERE decision_id = ? ORDER BY created_at DESC",
        (decision_id,),
    ).fetchall()
    return rows_to_dicts(rows)


def mark_attribution_review_status(
    conn: sqlite3.Connection, attribution_id: str, review_status: str
) -> dict[str, Any]:
    validate_choice(review_status, REVIEW_STATUSES, "review_status")
    _get_attribution(conn, attribution_id)
    with conn:
        conn.execute(
            "UPDATE assistant_attributions SET review_status = ? WHERE attribution_id = ?",
            (review_status, attribution_id),
        )
    return _get_attribution(conn, attribution_id)


def create_or_update_postmortem(conn: sqlite3.Connection, decision_id: str, **fields: Any) -> dict[str, Any]:
    _require_decision(conn, decision_id)
    existing = conn.execute(
        "SELECT * FROM postmortems WHERE decision_id = ? ORDER BY created_at DESC LIMIT 1",
        (decision_id,),
    ).fetchone()
    clean_fields = {k: v for k, v in fields.items() if k in POSTMORTEM_FIELDS}
    if existing:
        postmortem_id = existing["postmortem_id"]
        if clean_fields:
            assignments = ", ".join(f"{field} = :{field}" for field in clean_fields)
            clean_fields["postmortem_id"] = postmortem_id
            with conn:
                conn.execute(
                    f"UPDATE postmortems SET {assignments} WHERE postmortem_id = :postmortem_id",
                    clean_fields,
                )
    else:
        postmortem_id = fields.get("postmortem_id") or f"pm_{uuid.uuid4().hex[:16]}"
        values = {field: clean_fields.get(field) for field in POSTMORTEM_FIELDS}
        values.update(
            {
                "postmortem_id": postmortem_id,
                "decision_id": decision_id,
                "created_at": _now_iso(),
            }
        )
        with conn:
            conn.execute(
                """
                INSERT INTO postmortems (
                    postmortem_id, decision_id, created_at, pnl, thesis_quality,
                    execution_quality, sizing_quality, exit_quality, rule_read_quality,
                    primary_error_type, secondary_error_type, what_went_right,
                    what_went_wrong, lesson_keep, lesson_change, never_repeat,
                    future_rule, markdown_body
                ) VALUES (
                    :postmortem_id, :decision_id, :created_at, :pnl, :thesis_quality,
                    :execution_quality, :sizing_quality, :exit_quality, :rule_read_quality,
                    :primary_error_type, :secondary_error_type, :what_went_right,
                    :what_went_wrong, :lesson_keep, :lesson_change, :never_repeat,
                    :future_rule, :markdown_body
                )
                """,
                values,
            )
    return get_postmortem(conn, postmortem_id)


def get_postmortems(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT * FROM postmortems ORDER BY created_at DESC").fetchall()
    return rows_to_dicts(rows)


def get_postmortem(conn: sqlite3.Connection, postmortem_id: str) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM postmortems WHERE postmortem_id = ?", (postmortem_id,)).fetchone()
    if row is None:
        raise ValueError(f"postmortem_id not found: {postmortem_id}")
    return dict(row)


def get_trade(conn: sqlite3.Connection, trade_id: str) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM trades_raw WHERE trade_id = ?", (trade_id,)).fetchone()
    if row is None:
        raise ValueError(f"trade_id not found: {trade_id}")
    return dict(row)


def _get_attribution(conn: sqlite3.Connection, attribution_id: str) -> dict[str, Any]:
    row = conn.execute(
        "SELECT * FROM assistant_attributions WHERE attribution_id = ?", (attribution_id,)
    ).fetchone()
    if row is None:
        raise ValueError(f"attribution_id not found: {attribution_id}")
    return dict(row)


def _require_trade(conn: sqlite3.Connection, trade_id: str) -> None:
    if row_to_dict(conn.execute("SELECT trade_id FROM trades_raw WHERE trade_id = ?", (trade_id,)).fetchone()) is None:
        raise ValueError(f"trade_id not found: {trade_id}")


def _require_decision(conn: sqlite3.Connection, decision_id: str) -> None:
    if row_to_dict(
        conn.execute("SELECT decision_id FROM decisions WHERE decision_id = ?", (decision_id,)).fetchone()
    ) is None:
        raise ValueError(f"decision_id not found: {decision_id}")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
