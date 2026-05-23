from __future__ import annotations

from pathlib import Path

import pytest

from ledger.db import connect_db


@pytest.fixture
def conn():
    connection = connect_db(":memory:")
    yield connection
    connection.close()


@pytest.fixture
def fixture_csv() -> Path:
    return Path(__file__).parent / "fixtures" / "sample_trades.csv"
