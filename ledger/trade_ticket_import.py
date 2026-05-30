"""Import a Polyberg ``trade_ticket.json`` into the decision ledger.

This is the receiving half of the trade_ticket loop: Polyberg emits a structured
ticket from its adjudicator output, and this module turns each entry into a DRAFT
decision plus assistant-attribution rows.

Enum validation is deliberately lenient. The Polyberg market registry has not yet
been migrated to the ledger's enum vocabulary, so ``oracle_type`` / ``thesis_bucket``
often arrive as free text ("IMF Portwatch data", "Iran conflict"). Rather than reject
the whole ticket, unknown values are dropped to ``None`` and recorded as warnings;
they will start carrying through automatically once the registry migration lands.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ledger.enums import ASSISTANTS, ORACLE_TYPES, THESIS_BUCKETS
from ledger.services import add_assistant_attribution, create_decision


class TicketImportError(ValueError):
    """Raised when a ticket payload is structurally unusable."""


@dataclass
class TicketImportResult:
    decisions_seen: int = 0
    decisions_created: int = 0
    attributions_created: int = 0
    decision_ids: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


# Free-text aliases the adjudicator may emit, mapped to the closed assistant set.
_ASSISTANT_ALIASES = {
    "gpt": "GPT",
    "chatgpt": "GPT",
    "openai": "GPT",
    "claude": "CLAUDE",
    "anthropic": "CLAUDE",
    "grok": "GROK",
    "xai": "GROK",
    "user": "USER",
    "human": "USER",
    "me": "USER",
}
# Tokens that mean "every model in the two-model adjudication backed this".
_ALL_MODELS_TOKENS = {"both", "all", "consensus", "everyone"}
_ALL_MODELS = ("GPT", "CLAUDE")


def import_trade_ticket(
    conn: sqlite3.Connection,
    ticket: dict[str, Any] | str | Path,
    *,
    dry_run: bool = False,
    attribution: str = "DIRECT_RECOMMENDATION",
    review_status: str = "MODEL_PROPOSED",
) -> TicketImportResult:
    """Create decisions + attributions from a trade_ticket payload.

    ``ticket`` may be the already-parsed payload dict or a path to the JSON file.
    With ``dry_run=True`` nothing is written; the result still reports what would
    happen, including enum warnings.
    """
    payload = _coerce_payload(ticket)
    decisions = payload.get("decisions", [])
    if not isinstance(decisions, list):
        raise TicketImportError("ticket 'decisions' must be a list")

    result = TicketImportResult(decisions_seen=len(decisions))
    for index, entry in enumerate(decisions):
        try:
            _import_one(
                conn,
                entry,
                index,
                result,
                dry_run=dry_run,
                attribution=attribution,
                review_status=review_status,
            )
        except Exception as exc:  # keep going; partial imports are reported
            result.errors.append(f"decision[{index}] ({entry.get('market_id', '?')}): {exc}")
    return result


def _import_one(
    conn: sqlite3.Connection,
    entry: dict[str, Any],
    index: int,
    result: TicketImportResult,
    *,
    dry_run: bool,
    attribution: str,
    review_status: str,
) -> None:
    label = entry.get("market_id", f"#{index}")
    oracle_type = _lenient_enum(entry.get("oracle_type"), ORACLE_TYPES, "oracle_type", label, result)
    thesis_bucket = _lenient_enum(
        entry.get("thesis_bucket"), THESIS_BUCKETS, "thesis_bucket", label, result
    )

    fields = {
        "market_slug": entry.get("market_slug") or entry.get("market_id"),
        "market_title": entry.get("market_title"),
        "side": entry.get("side"),
        "intent": entry.get("intent"),
        "decision_type": entry.get("decision_type"),
        "price_used": entry.get("price_used"),
        "max_allocation": entry.get("max_allocation"),
        "thesis_summary": entry.get("thesis_summary"),
        "rule_summary": entry.get("rule_summary"),
        "oracle_type": oracle_type,
        "thesis_bucket": thesis_bucket,
        "status": entry.get("status") or "DRAFT",
    }

    attributions = entry.get("attributions", []) or []
    planned = [
        (assistant, att)
        for att in attributions
        for assistant in _normalize_assistants(att.get("source_model_support"), label, result)
    ]

    if dry_run:
        result.decisions_created += 1
        result.attributions_created += len(planned)
        return

    decision = create_decision(conn, **fields)
    decision_id = decision["decision_id"]
    result.decisions_created += 1
    result.decision_ids.append(decision_id)

    for assistant, att in planned:
        add_assistant_attribution(
            conn,
            decision_id=decision_id,
            assistant=assistant,
            attribution=attribution,
            recommended_price=att.get("recommended_price"),
            recommended_size=att.get("recommended_size"),
            evidence=att.get("evidence"),
            evidence_source="trade_ticket.json",
            review_status=review_status,
        )
        result.attributions_created += 1


def _coerce_payload(ticket: dict[str, Any] | str | Path) -> dict[str, Any]:
    if isinstance(ticket, dict):
        return ticket
    path = Path(ticket)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise TicketImportError(f"unable to read ticket {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise TicketImportError(f"invalid JSON in ticket {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise TicketImportError(f"ticket {path} must contain a JSON object")
    return data


def _lenient_enum(
    value: Any,
    allowed: set[str],
    field_name: str,
    label: str,
    result: TicketImportResult,
) -> str | None:
    if not value:
        return None
    if value in allowed:
        return value
    result.warnings.append(
        f"{label}: dropped {field_name}={value!r} (not a ledger enum value; "
        "awaiting registry migration)"
    )
    return None


def _normalize_assistants(
    support: Any,
    label: str,
    result: TicketImportResult,
) -> list[str]:
    if not support:
        return []
    tokens = support if isinstance(support, list) else [support]
    resolved: list[str] = []
    for token in tokens:
        key = str(token).strip().lower()
        if not key:
            continue
        if key in _ALL_MODELS_TOKENS:
            resolved.extend(_ALL_MODELS)
        elif key in _ASSISTANT_ALIASES:
            resolved.append(_ASSISTANT_ALIASES[key])
        elif key.upper() in ASSISTANTS:
            resolved.append(key.upper())
        else:
            result.warnings.append(
                f"{label}: skipped unrecognized source_model_support={token!r}"
            )
    # de-dupe while preserving order
    seen: set[str] = set()
    return [a for a in resolved if not (a in seen or seen.add(a))]
