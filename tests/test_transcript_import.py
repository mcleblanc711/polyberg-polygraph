from __future__ import annotations

import json
from pathlib import Path

import pytest

from ledger.import_trades import import_trades_csv
from ledger.transcript_import import (
    TranscriptImportResult,
    import_transcript_text,
    parse_chatgpt_json_turns,
    parse_transcript_turns,
)


# ── parse_transcript_turns ─────────────────────────────────────────────────────

def test_parse_human_assistant_labels():
    text = "Human: What markets look good?\nAssistant: The oil-hormuz-may market looks interesting."
    turns = parse_transcript_turns(text)
    assert len(turns) == 2
    assert turns[0].role == "user"
    assert turns[1].role == "assistant"
    assert "oil-hormuz-may" in turns[1].content


def test_parse_chatgpt_style_labels():
    text = "You: Any thoughts?\nChatGPT: Yes, I think turnout-2026 is worth watching."
    turns = parse_transcript_turns(text)
    assert [t.role for t in turns] == ["user", "assistant"]


def test_parse_user_claude_labels():
    text = "User: Look at this.\nClaude: That looks like a strong thesis."
    turns = parse_transcript_turns(text)
    assert [t.role for t in turns] == ["user", "assistant"]


def test_parse_multiline_turn():
    text = (
        "Human: What do you think?\n"
        "Assistant: I think the market is mispriced.\n"
        "The thesis is solid.\n"
        "Human: Thanks."
    )
    turns = parse_transcript_turns(text)
    assert len(turns) == 3
    assert "thesis is solid" in turns[1].content


def test_parse_unknown_labels_ignored():
    text = "System: Ignore this.\nHuman: Hi.\nAssistant: Hello."
    turns = parse_transcript_turns(text)
    assert len(turns) == 2
    assert turns[0].role == "user"


def test_parse_empty_text():
    assert parse_transcript_turns("") == []


# ── parse_chatgpt_json_turns ───────────────────────────────────────────────────

def _make_chatgpt_json(messages: list[dict]) -> dict:
    mapping = {}
    prev_id = None
    for i, msg in enumerate(messages):
        node_id = f"node_{i}"
        mapping[node_id] = {
            "id": node_id,
            "parent": prev_id,
            "children": [f"node_{i+1}"] if i + 1 < len(messages) else [],
            "message": {
                "id": node_id,
                "author": {"role": msg["role"]},
                "content": {"content_type": "text", "parts": [msg["content"]]},
                "create_time": 1700000000.0 + i,
            },
        }
        prev_id = node_id
    return {"title": "Test", "mapping": mapping}


def test_parse_chatgpt_json_basic():
    data = _make_chatgpt_json([
        {"role": "user", "content": "What markets?"},
        {"role": "assistant", "content": "The oil market is interesting."},
    ])
    turns = parse_chatgpt_json_turns(data)
    assert len(turns) == 2
    assert turns[1].role == "assistant"
    assert turns[1].timestamp is not None


def test_parse_chatgpt_json_list_of_conversations():
    conv = _make_chatgpt_json([
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there"},
    ])
    turns = parse_chatgpt_json_turns([conv])
    assert len(turns) == 2


def test_parse_chatgpt_json_skips_system_turns():
    data = _make_chatgpt_json([
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi"},
    ])
    turns = parse_chatgpt_json_turns(data)
    assert len(turns) == 2
    assert all(t.role in ("user", "assistant") for t in turns)


# ── import_transcript_text ─────────────────────────────────────────────────────

def test_slug_match_creates_needs_review_attribution(conn, fixture_csv):
    import_trades_csv(conn, fixture_csv)
    # Fixture has 2 trades with slug oil-hormuz-may — both get an attribution.
    text = "Human: Thoughts?\nAssistant: oil-hormuz-may is trading below fair value."
    result = import_transcript_text(conn, text, "GPT", "test.txt")
    assert result.attributions_created == 2
    assert result.matches_found == 2
    assert result.errors == []
    row = conn.execute(
        "SELECT review_status, attribution, assistant FROM assistant_attributions LIMIT 1"
    ).fetchone()
    assert row["review_status"] == "NEEDS_REVIEW"
    assert row["attribution"] == "UNCLEAR"
    assert row["assistant"] == "GPT"


def test_title_keyword_match_creates_lower_quality(conn, fixture_csv):
    import_trades_csv(conn, fixture_csv)
    # "election-turnout-2026" / "Will turnout exceed 60%?"
    text = "Human: Ask me.\nAssistant: turnout and election exceed the threshold."
    result = import_transcript_text(conn, text, "CLAUDE", "test2.txt")
    assert result.attributions_created >= 1
    row = conn.execute(
        "SELECT match_quality FROM assistant_attributions ORDER BY match_quality ASC LIMIT 1"
    ).fetchone()
    assert row["match_quality"] < 0.9


def test_deduplication_prevents_double_import(conn, fixture_csv):
    import_trades_csv(conn, fixture_csv)
    # election-turnout-2026 has exactly 1 trade, so we get 1 attribution on first import.
    text = "Human: Hi.\nAssistant: election-turnout-2026 looks interesting."
    result1 = import_transcript_text(conn, text, "GPT", "same_file.txt")
    result2 = import_transcript_text(conn, text, "GPT", "same_file.txt")
    assert result1.attributions_created == 1
    assert result2.attributions_created == 0
    assert result2.duplicates_skipped == 1
    total = conn.execute("SELECT COUNT(*) FROM assistant_attributions").fetchone()[0]
    assert total == 1


def test_no_trades_returns_empty_result(conn):
    text = "Human: Hi.\nAssistant: oil-hormuz-may is great."
    result = import_transcript_text(conn, text, "GPT", "test.txt")
    assert result.attributions_created == 0
    assert result.matches_found == 0


def test_invalid_assistant_raises(conn):
    with pytest.raises(ValueError, match="assistant must be one of"):
        import_transcript_text(conn, "text", "BARD", "test.txt")


def test_chatgpt_json_format_flag(conn, fixture_csv):
    import_trades_csv(conn, fixture_csv)
    data = _make_chatgpt_json([
        {"role": "user", "content": "What about turnout?"},
        {"role": "assistant", "content": "election-turnout-2026 is at 31 cents."},
    ])
    result = import_transcript_text(
        conn, json.dumps(data), "GPT", "export.json", fmt="chatgpt_json"
    )
    assert result.attributions_created == 1


def test_no_match_produces_no_attributions(conn, fixture_csv):
    import_trades_csv(conn, fixture_csv)
    text = "Human: Hi.\nAssistant: The weather is nice today."
    result = import_transcript_text(conn, text, "GPT", "no_match.txt")
    assert result.attributions_created == 0
    assert result.matches_found == 0
