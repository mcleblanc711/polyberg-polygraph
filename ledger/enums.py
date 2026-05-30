"""Shared enum values and validation helpers."""

PROJECTS = {
    "GEO_OIL",
    "ELECTIONS",
    "SPORTS_MM",
    "SPORTS_DIRECTIONAL",
    "EXPERIMENTAL",
    "CASH",
}

ASSISTANTS = {"GPT", "CLAUDE", "GROK", "USER"}

ATTRIBUTIONS = {
    "DIRECT_RECOMMENDATION",
    "SUPPORTED_AFTER_REVIEW",
    "OPPOSED",
    "MENTIONED_BUT_NOT_RECOMMENDED",
    "NO_MATCH_FOUND",
    "NOT_INVOLVED",
    "UNCLEAR",
}

REVIEW_STATUSES = {
    "DRAFT",
    "MODEL_PROPOSED",
    "USER_CONFIRMED",
    "REJECTED",
    "NEEDS_REVIEW",
}

ORACLE_TYPES = {"data", "subjective", "hybrid"}

THESIS_BUCKETS = {
    "hormuz_transit",
    "iran_nuclear",
    "iran_diplomacy",
    "oil_commodities",
    "btc_binary",
    "other",
}

EXIT_REASONS = {"voluntary", "forced_liquidity", "stop", "resolution"}

REASON_ERROR_CODES = {
    "RULE_ARB",
    "CLEAN_ORACLE_NO",
    "HEADLINE_OVERSHOOT",
    "FAST_INFO_REPRICE",
    "MODEL_EDGE",
    "SPREAD_CAPTURE",
    "HEDGE",
    "LOTTERY",
    "MISTAKE_FIX",
    "THESIS_INVALIDATED",
    "PROFIT_TAKE",
    "BAD_RULE_READ",
    "BAD_FACTS",
    "BAD_MODEL",
    "BAD_PRICE",
    "BAD_SIZE",
    "BAD_TIMING",
    "BAD_EXIT",
    "BAD_CORRELATION",
    "ADVERSE_SELECTION",
    "EMOTIONAL_TRADE",
    "FOMO",
    "REVENGE_TRADE",
    "GOOD_PROCESS_BAD_RESULT",
    "BAD_PROCESS_GOOD_RESULT",
    "PLATFORM_OR_RESOLUTION_WEIRDNESS",
}


def validate_choice(value: str, allowed: set[str], field_name: str) -> str:
    if value not in allowed:
        choices = ", ".join(sorted(allowed))
        raise ValueError(f"{field_name} must be one of: {choices}")
    return value
