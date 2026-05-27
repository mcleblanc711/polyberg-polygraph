"""Shared utilities used across ledger modules."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def parse_timestamp(value: str) -> datetime:
    """Parse a timestamp that may be a Unix epoch integer string or ISO-8601."""
    if str(value).lstrip("-").isdigit():
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def timestamp_to_float(value: Any) -> float:
    """Return a sortable float (Unix seconds) from any timestamp value."""
    try:
        return parse_timestamp(str(value)).timestamp()
    except (ValueError, OSError):
        return 0.0
