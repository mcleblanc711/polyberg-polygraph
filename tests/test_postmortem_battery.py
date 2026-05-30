"""Tests for the post-mortem battery (Phase 3)."""

from __future__ import annotations

import pytest

from ledger.postmortem_battery import BatteryResult, battery_to_dict, run_battery
from ledger.services import create_decision, create_or_update_postmortem


def _seed(conn, decisions_data):
    """Create decisions + postmortems from a list of dicts, return decision ids."""
    ids = []
    for d in decisions_data:
        pnl = d.pop("pnl", None)
        dec = create_decision(conn, **d)
        if pnl is not None:
            create_or_update_postmortem(conn, dec["decision_id"], pnl=pnl)
        ids.append(dec["decision_id"])
    return ids


def test_battery_empty_db(conn):
    result = run_battery(conn)
    assert isinstance(result, BatteryResult)
    assert result.overall.n == 0
    assert result.by_oracle_type == {}
    assert result.by_thesis_bucket == {}
    assert result.by_exit_reason == {}


def test_battery_excludes_decisions_without_postmortem(conn):
    create_decision(conn, project="GEO_OIL", oracle_type="data")
    result = run_battery(conn)
    assert result.overall.n == 0


def test_battery_counts_wins_and_losses(conn):
    _seed(conn, [
        {"project": "GEO_OIL", "oracle_type": "data", "pnl": 50.0},
        {"project": "GEO_OIL", "oracle_type": "data", "pnl": -20.0},
        {"project": "GEO_OIL", "oracle_type": "data", "pnl": 30.0},
    ])
    result = run_battery(conn)
    assert result.overall.n == 3
    assert result.overall.wins == 2
    assert result.overall.losses == 1
    assert abs(result.overall.pnl_sum - 60.0) < 1e-9


def test_battery_groups_by_oracle_type(conn):
    _seed(conn, [
        {"project": "GEO_OIL", "oracle_type": "data", "pnl": 100.0},
        {"project": "GEO_OIL", "oracle_type": "data", "pnl": 80.0},
        {"project": "GEO_OIL", "oracle_type": "subjective", "pnl": -30.0},
    ])
    result = run_battery(conn)
    assert result.by_oracle_type["data"].n == 2
    assert result.by_oracle_type["data"].wins == 2
    assert result.by_oracle_type["subjective"].n == 1
    assert result.by_oracle_type["subjective"].wins == 0


def test_battery_groups_by_thesis_bucket(conn):
    _seed(conn, [
        {"project": "GEO_OIL", "thesis_bucket": "hormuz_transit", "pnl": 50.0},
        {"project": "GEO_OIL", "thesis_bucket": "hormuz_transit", "pnl": -10.0},
        {"project": "GEO_OIL", "thesis_bucket": "oil_commodities", "pnl": 20.0},
    ])
    result = run_battery(conn)
    assert result.by_thesis_bucket["hormuz_transit"].n == 2
    assert result.by_thesis_bucket["oil_commodities"].n == 1


def test_battery_groups_by_exit_reason(conn):
    _seed(conn, [
        {"project": "GEO_OIL", "exit_reason": "voluntary", "pnl": 40.0},
        {"project": "GEO_OIL", "exit_reason": "forced_liquidity", "pnl": -50.0},
        {"project": "GEO_OIL", "exit_reason": "forced_liquidity", "pnl": -30.0},
    ])
    result = run_battery(conn)
    assert result.by_exit_reason["voluntary"].wins == 1
    assert result.by_exit_reason["forced_liquidity"].wins == 0
    assert result.by_exit_reason["forced_liquidity"].n == 2


def test_battery_win_rate_posterior_mean_shrinks_toward_half(conn):
    # 1 win out of 1 with uniform prior → posterior (2/3), not raw 1.0
    _seed(conn, [{"project": "GEO_OIL", "oracle_type": "data", "pnl": 100.0}])
    result = run_battery(conn)
    assert result.by_oracle_type["data"].win_rate.posterior_mean < 1.0
    assert result.by_oracle_type["data"].win_rate.posterior_mean > 0.5


def test_battery_brier_score_computed_when_price_used_present(conn):
    _seed(conn, [
        {"project": "GEO_OIL", "price_used": 0.7, "pnl": 30.0},   # win, forecast 0.7
        {"project": "GEO_OIL", "price_used": 0.4, "pnl": -20.0},  # loss, forecast 0.4
    ])
    result = run_battery(conn)
    assert result.overall.brier is not None
    # (0.7-1)^2 + (0.4-0)^2 / 2 = 0.09 + 0.16 / 2 = 0.125
    assert abs(result.overall.brier - 0.125) < 1e-9


def test_battery_brier_none_when_no_price_used(conn):
    _seed(conn, [{"project": "GEO_OIL", "pnl": 50.0}])
    result = run_battery(conn)
    assert result.overall.brier is None


def test_battery_unset_group_for_null_oracle_type(conn):
    _seed(conn, [{"project": "GEO_OIL", "pnl": 10.0}])
    result = run_battery(conn)
    assert "unset" in result.by_oracle_type


def test_battery_to_dict_is_json_safe(conn):
    _seed(conn, [
        {"project": "GEO_OIL", "oracle_type": "data", "price_used": 0.6, "pnl": 40.0},
        {"project": "GEO_OIL", "oracle_type": "subjective", "pnl": -10.0},
    ])
    d = battery_to_dict(run_battery(conn))
    assert isinstance(d, dict)
    assert "by_oracle_type" in d
    assert "by_thesis_bucket" in d
    assert "by_exit_reason" in d
    assert "overall" in d
    data_slice = d["by_oracle_type"]["data"]
    assert "win_rate" in data_slice
    assert "posterior_mean" in data_slice["win_rate"]
    assert isinstance(data_slice["brier"], float)


def test_phase2_enum_validation_on_create(conn):
    with pytest.raises(ValueError, match="oracle_type must be one of"):
        create_decision(conn, project="GEO_OIL", oracle_type="MADE_UP")

    with pytest.raises(ValueError, match="thesis_bucket must be one of"):
        create_decision(conn, project="GEO_OIL", thesis_bucket="iran_conflict")

    with pytest.raises(ValueError, match="exit_reason must be one of"):
        create_decision(conn, project="GEO_OIL", exit_reason="DUNNO")


def test_phase2_enum_validation_on_edit(conn):
    dec = create_decision(conn, project="GEO_OIL")
    from ledger.services import edit_decision

    with pytest.raises(ValueError, match="oracle_type must be one of"):
        edit_decision(conn, dec["decision_id"], oracle_type="bad_value")


def test_phase2_fields_round_trip(conn):
    dec = create_decision(
        conn,
        project="GEO_OIL",
        oracle_type="data",
        thesis_bucket="hormuz_transit",
        exit_reason="voluntary",
    )
    assert dec["oracle_type"] == "data"
    assert dec["thesis_bucket"] == "hormuz_transit"
    assert dec["exit_reason"] == "voluntary"
