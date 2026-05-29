"""CSV import for immutable Polymarket trade exports."""

from __future__ import annotations

import hashlib
import json
import math
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


class TradeImportValidationError(ValueError):
    """Raised when a CSV cannot be normalized into raw trades."""


@dataclass
class ImportResult:
    rows_seen: int = 0
    rows_imported: int = 0
    duplicates_skipped: int = 0
    non_trade_skipped: int = 0
    errors: list[str] = field(default_factory=list)


COLUMN_ALIASES = {
    "timestamp": {"timestamp", "timestamp_utc", "time", "date", "created_at", "created"},
    "market_slug": {"market_slug", "market", "slug", "market_id", "condition_id"},
    "market_title": {
        "market_title",
        "title",
        "question",
        "market_question",
        "marketname",
        "market_name",
        "condition_title",
    },
    "outcome": {"outcome", "token", "position", "asset", "contract", "tokenname", "token_name"},
    "side": {"side", "buy_sell", "buy/sell", "direction"},
    "action": {"action", "type", "trade_type", "tx_type"},
    "price": {"price", "price_usdc", "avg_price", "average_price"},
    "shares": {"shares", "size", "quantity", "qty", "amount_shares", "tokenamount", "token_amount"},
    "notional": {
        "notional",
        "notional_usdc",
        "amount",
        "value",
        "total",
        "cash_value",
        "usdcamount",
        "usdc_amount",
    },
    "fees": {"fees", "fee", "fee_usdc"},
}

_TRADE_ACTIONS = {"buy", "sell", "trade"}


def import_trades_csv(conn: sqlite3.Connection, csv_path: str | Path) -> ImportResult:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(path)

    df = pd.read_csv(path)
    result = ImportResult(rows_seen=len(df))
    if df.empty:
        return result

    rename_map = _build_rename_map(df.columns)
    normalized = df.rename(columns=rename_map)

    if "action" in normalized.columns:
        is_trade = normalized["action"].str.lower().isin(_TRADE_ACTIONS)
        result.non_trade_skipped = int((~is_trade).sum())
        normalized = normalized[is_trade].reset_index(drop=True)
        df = df[is_trade.values].reset_index(drop=True)

    if normalized.empty:
        return result

    if "price" not in normalized.columns:
        normalized = _derive_price(normalized)

    _validate_required_columns(normalized)

    imported_at = _now_iso()
    with conn:
        for idx, row in normalized.iterrows():
            try:
                raw_row = _clean_mapping(df.iloc[idx].to_dict())
                trade = _normalize_row(row.to_dict(), raw_row, imported_at, path.name)
                conn.execute(
                    """
                    INSERT INTO trades_raw (
                        trade_id, source_row_hash, imported_at, source_file, timestamp,
                        market_slug, market_title, outcome, side, action, price, shares,
                        notional, fees, raw_json
                    ) VALUES (
                        :trade_id, :source_row_hash, :imported_at, :source_file, :timestamp,
                        :market_slug, :market_title, :outcome, :side, :action, :price, :shares,
                        :notional, :fees, :raw_json
                    )
                    ON CONFLICT(source_row_hash) DO NOTHING
                    """,
                    trade,
                )
                if conn.total_changes:
                    # total_changes is cumulative, so use rowcount for this statement.
                    pass
                if conn.execute("SELECT changes()").fetchone()[0] == 1:
                    result.rows_imported += 1
                else:
                    result.duplicates_skipped += 1
            except Exception as exc:  # Keep importing other rows and report row-local errors.
                result.errors.append(f"row {idx + 2}: {exc}")
    return result


def _build_rename_map(columns: pd.Index) -> dict[str, str]:
    rename: dict[str, str] = {}
    seen_targets: set[str] = set()
    for column in columns:
        key = _canonical_column_name(str(column))
        for target, aliases in COLUMN_ALIASES.items():
            if key in aliases and target not in seen_targets:
                rename[column] = target
                seen_targets.add(target)
                break
    return rename


def _validate_required_columns(df: pd.DataFrame) -> None:
    missing = []
    for column in ["timestamp", "outcome", "price", "shares"]:
        if column not in df.columns:
            missing.append(column)
    if "market_slug" not in df.columns and "market_title" not in df.columns:
        missing.append("market_slug or market_title")
    if "side" not in df.columns and "action" not in df.columns:
        missing.append("side or action")
    if missing:
        raise TradeImportValidationError("Missing required CSV columns: " + ", ".join(missing))


def _normalize_row(
    row: dict[str, Any], raw_row: dict[str, Any], imported_at: str, source_file: str
) -> dict[str, Any]:
    timestamp = _required_text(row.get("timestamp"), "timestamp")
    market_slug = _optional_text(row.get("market_slug"))
    market_title = _optional_text(row.get("market_title"))
    if not market_slug and not market_title:
        raise TradeImportValidationError("market_slug or market_title is required")

    side = _optional_text(row.get("side"))
    action = _optional_text(row.get("action"))
    if not side and action:
        side = action
    if not action and side:
        action = side

    price = _required_float(row.get("price"), "price")
    shares = _required_float(row.get("shares"), "shares")
    notional = _optional_float(row.get("notional"))
    if notional is None:
        notional = price * shares

    normalized_for_hash = {
        "timestamp": timestamp,
        "market_slug": market_slug,
        "market_title": market_title,
        "outcome": _required_text(row.get("outcome"), "outcome"),
        "side": side,
        "action": action,
        "price": price,
        "shares": shares,
        "notional": notional,
        "fees": _optional_float(row.get("fees")) or 0.0,
        "raw": raw_row,
    }
    source_row_hash = _hash_json(normalized_for_hash)
    return {
        "trade_id": f"trd_{source_row_hash[:24]}",
        "source_row_hash": source_row_hash,
        "imported_at": imported_at,
        "source_file": source_file,
        "timestamp": timestamp,
        "market_slug": market_slug,
        "market_title": market_title,
        "outcome": normalized_for_hash["outcome"],
        "side": side,
        "action": action,
        "price": price,
        "shares": shares,
        "notional": notional,
        "fees": normalized_for_hash["fees"],
        "raw_json": json.dumps(raw_row, sort_keys=True, default=str),
    }


def _derive_price(df: pd.DataFrame) -> pd.DataFrame:
    if "notional" not in df.columns or "shares" not in df.columns:
        return df
    df = df.copy()
    notional = pd.to_numeric(df["notional"], errors="coerce")
    shares = pd.to_numeric(df["shares"], errors="coerce").replace(0, pd.NA)
    df["price"] = notional / shares
    return df


def _hash_json(value: dict[str, Any]) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _canonical_column_name(value: str) -> str:
    return value.strip().lower().replace(" ", "_").replace("-", "_")


def _clean_mapping(value: dict[str, Any]) -> dict[str, Any]:
    return {str(k): _clean_value(v) for k, v in value.items()}


def _clean_value(value: Any) -> Any:
    if isinstance(value, float) and math.isnan(value):
        return None
    if pd.isna(value):
        return None
    return value


def _required_text(value: Any, field_name: str) -> str:
    text = _optional_text(value)
    if not text:
        raise TradeImportValidationError(f"{field_name} is required")
    return text


def _optional_text(value: Any) -> str | None:
    value = _clean_value(value)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _required_float(value: Any, field_name: str) -> float:
    number = _optional_float(value)
    if number is None:
        raise TradeImportValidationError(f"{field_name} is required")
    return number


def _optional_float(value: Any) -> float | None:
    value = _clean_value(value)
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace("$", "").replace(",", "").strip())
    except ValueError as exc:
        raise TradeImportValidationError(f"expected numeric value, got {value!r}") from exc


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
