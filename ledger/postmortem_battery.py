"""Post-mortem battery: aggregate win rates and calibration metrics from the ledger.

Produces slices grouped by oracle_type, thesis_bucket, and exit_reason.  Each
slice reports a beta-binomial win-rate estimate (shrunk toward 0.5 for small
samples) and, where price_used data is available, a raw Brier score.

Win/loss outcome: pnl > 0 is a win.  pnl == 0 is treated as a loss (rare —
Polymarket pays full stake on resolution, so a break-even requires unusual
circumstances).
"""

from __future__ import annotations

import sqlite3
from dataclasses import asdict, dataclass
from typing import Any

from polyberg_core.scoring import BetaBinomialSummary, brier_score, summarize_beta_binomial

__all__ = ["BatterySlice", "BatteryResult", "run_battery"]

_BATTERY_QUERY = """
    SELECT
        d.oracle_type,
        d.thesis_bucket,
        d.exit_reason,
        d.price_used,
        pm.pnl
    FROM decisions d
    JOIN postmortems pm ON pm.decision_id = d.decision_id
    WHERE pm.pnl IS NOT NULL
"""


@dataclass(frozen=True)
class BatterySlice:
    key: str
    n: int
    wins: int
    losses: int
    pnl_sum: float
    win_rate: BetaBinomialSummary
    brier: float | None  # None when no price_used data in the slice


@dataclass(frozen=True)
class BatteryResult:
    by_oracle_type: dict[str, BatterySlice]
    by_thesis_bucket: dict[str, BatterySlice]
    by_exit_reason: dict[str, BatterySlice]
    overall: BatterySlice


def run_battery(conn: sqlite3.Connection) -> BatteryResult:
    rows = conn.execute(_BATTERY_QUERY).fetchall()
    rows = [dict(r) for r in rows]

    def _slice(key: str, subset: list[dict[str, Any]]) -> BatterySlice:
        wins = sum(1 for r in subset if r["pnl"] > 0)
        losses = len(subset) - wins
        pnl_sum = sum(r["pnl"] for r in subset)
        summary = summarize_beta_binomial(wins, len(subset))
        priced = [r for r in subset if r["price_used"] is not None]
        bs: float | None = None
        if priced:
            forecasts = [r["price_used"] for r in priced]
            outcomes = [1 if r["pnl"] > 0 else 0 for r in priced]
            bs = brier_score(forecasts, outcomes)
        return BatterySlice(
            key=key,
            n=len(subset),
            wins=wins,
            losses=losses,
            pnl_sum=pnl_sum,
            win_rate=summary,
            brier=bs,
        )

    def _group_by(field: str) -> dict[str, BatterySlice]:
        groups: dict[str, list[dict[str, Any]]] = {}
        for r in rows:
            k = r[field] or "unset"
            groups.setdefault(k, []).append(r)
        return {k: _slice(k, v) for k, v in groups.items()}

    return BatteryResult(
        by_oracle_type=_group_by("oracle_type"),
        by_thesis_bucket=_group_by("thesis_bucket"),
        by_exit_reason=_group_by("exit_reason"),
        overall=_slice("overall", rows),
    )


def battery_to_dict(result: BatteryResult) -> dict[str, Any]:
    """Serialize a BatteryResult to a plain dict (JSON-safe via float/int)."""

    def _slice_dict(s: BatterySlice) -> dict[str, Any]:
        return {
            "key": s.key,
            "n": s.n,
            "wins": s.wins,
            "losses": s.losses,
            "pnl_sum": s.pnl_sum,
            "win_rate": {
                "posterior_mean": s.win_rate.posterior_mean,
                "ci_low": s.win_rate.ci_low,
                "ci_high": s.win_rate.ci_high,
            },
            "brier": s.brier,
        }

    return {
        "by_oracle_type": {k: _slice_dict(v) for k, v in result.by_oracle_type.items()},
        "by_thesis_bucket": {k: _slice_dict(v) for k, v in result.by_thesis_bucket.items()},
        "by_exit_reason": {k: _slice_dict(v) for k, v in result.by_exit_reason.items()},
        "overall": _slice_dict(result.overall),
    }
