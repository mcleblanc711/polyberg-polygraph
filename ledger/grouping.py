"""Explainable candidate grouping heuristics for unlinked trades."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from itertools import groupby
from typing import Any


def suggest_candidate_groups(
    trades: list[dict[str, Any]],
    max_hours: float = 24,
    max_price_delta: float = 0.05,
) -> list[dict[str, Any]]:
    ordered = sorted(
        trades,
        key=lambda t: (
            t.get("market_slug") or t.get("market_title") or "",
            t.get("outcome") or "",
            t.get("side") or t.get("action") or "",
            t.get("timestamp") or "",
        ),
    )
    suggestions: list[dict[str, Any]] = []

    def grouping_key(trade: dict[str, Any]) -> tuple[str, str, str]:
        return (
            trade.get("market_slug") or trade.get("market_title") or "",
            trade.get("outcome") or "",
            trade.get("side") or trade.get("action") or "",
        )

    for _, group_iter in groupby(ordered, key=grouping_key):
        group = list(group_iter)
        if len(group) < 2:
            continue
        bucket: list[dict[str, Any]] = []
        for trade in group:
            if not bucket:
                bucket.append(trade)
                continue
            if _fits_bucket(bucket, trade, max_hours, max_price_delta):
                bucket.append(trade)
            else:
                _append_suggestion(suggestions, bucket, max_hours, max_price_delta)
                bucket = [trade]
        _append_suggestion(suggestions, bucket, max_hours, max_price_delta)

    return suggestions


def _fits_bucket(
    bucket: list[dict[str, Any]], trade: dict[str, Any], max_hours: float, max_price_delta: float
) -> bool:
    last = bucket[-1]
    hours = abs((_parse_time(trade["timestamp"]) - _parse_time(last["timestamp"])).total_seconds()) / 3600
    prices = [float(t["price"]) for t in bucket if t.get("price") is not None]
    avg_price = sum(prices) / len(prices)
    return hours <= max_hours and abs(float(trade["price"]) - avg_price) <= max_price_delta


def _append_suggestion(
    suggestions: list[dict[str, Any]],
    bucket: list[dict[str, Any]],
    max_hours: float,
    max_price_delta: float,
) -> None:
    if len(bucket) < 2:
        return
    trade_ids = [trade["trade_id"] for trade in bucket]
    first, last = bucket[0], bucket[-1]
    confidence = min(0.95, 0.55 + 0.1 * len(bucket))
    group_hash = hashlib.sha1(",".join(trade_ids).encode("utf-8")).hexdigest()[:12]
    suggestions.append(
        {
            "candidate_group_id": f"grp_{group_hash}",
            "trade_ids": trade_ids,
            "reason": (
                "Same market/outcome/side-action, within "
                f"{max_hours:g} hours, and prices within {max_price_delta:g}. "
                f"First timestamp: {first['timestamp']}; last timestamp: {last['timestamp']}."
            ),
            "confidence": round(confidence, 2),
        }
    )


def _parse_time(value: str) -> datetime:
    # Unix epoch integer (Polymarket history export)
    if value.lstrip("-").isdigit():
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
