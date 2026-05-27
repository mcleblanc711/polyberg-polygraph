"""Generate a formatted trade list for AI-assisted attribution labeling."""

from __future__ import annotations

from itertools import groupby
from typing import Any

from ledger.utils import parse_timestamp


def generate_attribution_prompt(trades: list[dict[str, Any]]) -> str:
    """Return a text document suitable for pasting into Claude or GPT.

    Trades are sorted newest-first and grouped by UTC date. The caller is
    responsible for pre-filtering to a date range if desired.
    """
    if not trades:
        return "No trades to attribute."

    sorted_trades = sorted(
        trades,
        key=lambda t: parse_timestamp(str(t["timestamp"])).timestamp(),
        reverse=True,
    )

    lines = [
        "# Polymarket Trade Attribution",
        "",
        "For each trade you recognise from our conversations, reply with:",
        "CLAUDE | GPT | USER (your own call) | MIXED",
        "Leave blank anything you don't recognise.",
        "",
        "---",
        "",
    ]

    for date_str, group_iter in groupby(sorted_trades, key=lambda t: _date_str(t["timestamp"])):
        group = list(group_iter)
        lines.append(f"## {date_str}  ({len(group)} trade{'s' if len(group) != 1 else ''})")
        lines.append("")
        for trade in group:
            lines.append(_format_trade(trade))
        lines.append("")

    return "\n".join(lines)


def _format_trade(trade: dict[str, Any]) -> str:
    time = _time_str(trade["timestamp"])
    market = trade.get("market_title") or trade.get("market_slug") or "Unknown market"
    outcome = trade.get("outcome") or ""
    action = (trade.get("action") or trade.get("side") or "").title()
    price = trade.get("price")
    shares = trade.get("shares")
    notional = trade.get("notional")

    price_str = f"${float(price):.3f}" if price is not None else ""
    shares_str = f"× {_fmt_shares(shares)}" if shares is not None else ""
    notional_str = f"(${float(notional):.2f})" if notional is not None else ""

    detail = "  ".join(p for p in [outcome, action, price_str, shares_str, notional_str] if p)
    return f"  {time}  {market}  |  {detail}  |  ___________"


def _date_str(timestamp: str) -> str:
    return parse_timestamp(timestamp).strftime("%Y-%m-%d")


def _time_str(timestamp: str) -> str:
    return parse_timestamp(timestamp).strftime("%H:%M")


def _fmt_shares(value: Any) -> str:
    f = float(value)
    return str(int(f)) if f == int(f) else f"{f:.2f}"
