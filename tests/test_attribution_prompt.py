"""Tests for attribution prompt generation."""

from __future__ import annotations

from ledger.attribution_prompt import generate_attribution_prompt


def _trade(timestamp: str, market_title: str, outcome: str, action: str, price: float, shares: float) -> dict:
    return {
        "trade_id": f"trd_{hash(timestamp)}",
        "timestamp": timestamp,
        "market_title": market_title,
        "market_slug": None,
        "outcome": outcome,
        "action": action,
        "side": action,
        "price": price,
        "shares": shares,
        "notional": round(price * shares, 4),
    }


def test_empty_trades_returns_no_trades_message():
    result = generate_attribution_prompt([])
    assert "No trades" in result


def test_output_contains_header():
    trades = [_trade("1779681718", "Hormuz closes?", "Yes", "Buy", 0.42, 100)]
    result = generate_attribution_prompt(trades)
    assert "# Polymarket Trade Attribution" in result


def test_market_title_appears_in_output():
    trades = [_trade("1779681718", "Hormuz closes?", "Yes", "Buy", 0.42, 100)]
    result = generate_attribution_prompt(trades)
    assert "Hormuz closes?" in result


def test_outcome_and_action_appear():
    trades = [_trade("1779681718", "Hormuz closes?", "Yes", "Buy", 0.42, 100)]
    result = generate_attribution_prompt(trades)
    assert "Yes" in result
    assert "Buy" in result


def test_price_and_shares_formatted():
    trades = [_trade("1779681718", "Hormuz closes?", "Yes", "Buy", 0.42, 100)]
    result = generate_attribution_prompt(trades)
    assert "$0.420" in result
    assert "100" in result


def test_attribution_blank_line_present():
    trades = [_trade("1779681718", "Hormuz closes?", "Yes", "Buy", 0.42, 100)]
    result = generate_attribution_prompt(trades)
    assert "___________" in result


def test_unix_and_iso_timestamps_both_work():
    unix_trade = _trade("1779681718", "Market A", "Yes", "Buy", 0.5, 10)
    iso_trade = _trade("2026-05-27T10:30:00Z", "Market B", "No", "Sell", 0.3, 20)
    result = generate_attribution_prompt([unix_trade, iso_trade])
    assert "Market A" in result
    assert "Market B" in result


def test_trades_sorted_newest_first():
    older = _trade("1779000000", "Old Market", "Yes", "Buy", 0.4, 10)
    newer = _trade("1779681718", "New Market", "No", "Sell", 0.6, 5)
    result = generate_attribution_prompt([older, newer])
    assert result.index("New Market") < result.index("Old Market")


def test_date_group_header_present():
    trades = [_trade("1779681718", "Hormuz closes?", "Yes", "Buy", 0.42, 100)]
    result = generate_attribution_prompt(trades)
    assert "##" in result
    assert "2026-" in result


def test_trade_count_in_header():
    trades = [
        _trade("1779681718", "Market A", "Yes", "Buy", 0.4, 10),
        _trade("1779681700", "Market B", "No", "Sell", 0.6, 5),
    ]
    result = generate_attribution_prompt(trades)
    assert "2 trades" in result


def test_whole_shares_displayed_without_decimal():
    trades = [_trade("1779681718", "Market", "Yes", "Buy", 0.5, 100.0)]
    result = generate_attribution_prompt(trades)
    assert "× 100" in result
    assert "× 100.00" not in result


def test_fractional_shares_displayed_with_decimal():
    trades = [_trade("1779681718", "Market", "Yes", "Buy", 0.5, 19.99)]
    result = generate_attribution_prompt(trades)
    assert "× 19.99" in result
