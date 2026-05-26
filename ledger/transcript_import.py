"""Transcript import: parse GPT/Claude chat exports and create NEEDS_REVIEW attributions."""

from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ledger.enums import ASSISTANTS
from ledger.services import add_assistant_attribution


@dataclass
class TranscriptTurn:
    role: str  # "user" | "assistant"
    content: str
    timestamp: str | None = None


@dataclass
class TranscriptImportResult:
    turns_parsed: int = 0
    assistant_turns: int = 0
    matches_found: int = 0
    attributions_created: int = 0
    duplicates_skipped: int = 0
    errors: list[str] = field(default_factory=list)


_ASSISTANT_LABELS = frozenset({
    "assistant", "claude", "chatgpt", "gpt", "gpt-4", "gpt-3.5", "grok", "ai",
})
_USER_LABELS = frozenset({
    "human", "user", "you",
})

# Matches "Label: " at the start of a line (multiline mode).
_LABEL_RE = re.compile(r"^([\w][\w\-\.]*)\s*:\s*", re.MULTILINE)

_STOP_WORDS = frozenset({
    "a", "an", "the", "will", "won", "is", "are", "was", "were", "be", "been",
    "have", "has", "do", "does", "did", "by", "at", "to", "of", "in", "on",
    "for", "or", "and", "but", "not", "no", "yes", "with", "from", "this",
    "that", "it", "its", "i", "we", "you", "he", "she", "they", "if", "as",
})


# ── Public API ─────────────────────────────────────────────────────────────────

def parse_transcript_turns(text: str) -> list[TranscriptTurn]:
    """Parse plain-text transcript (Human/Assistant, You/ChatGPT, User/Claude, etc.)."""
    turns: list[TranscriptTurn] = []
    label_matches = list(_LABEL_RE.finditer(text))
    for i, m in enumerate(label_matches):
        label = m.group(1).strip().lower()
        start = m.end()
        end = label_matches[i + 1].start() if i + 1 < len(label_matches) else len(text)
        content = text[start:end].strip()
        if not content:
            continue
        if label in _ASSISTANT_LABELS:
            role = "assistant"
        elif label in _USER_LABELS:
            role = "user"
        else:
            continue
        turns.append(TranscriptTurn(role=role, content=content))
    return turns


def parse_chatgpt_json_turns(data: dict | list) -> list[TranscriptTurn]:
    """Parse ChatGPT JSON export (single conversation dict or list of conversations)."""
    conversations = data if isinstance(data, list) else [data]
    turns: list[TranscriptTurn] = []
    for conv in conversations:
        mapping = conv.get("mapping") or {}
        for node in _bfs_chatgpt_nodes(mapping):
            msg = node.get("message")
            if not msg:
                continue
            role_raw = (msg.get("author") or {}).get("role", "")
            if role_raw == "assistant":
                role = "assistant"
            elif role_raw == "user":
                role = "user"
            else:
                continue
            content_obj = msg.get("content") or {}
            parts = content_obj.get("parts") or []
            content = "\n".join(str(p) for p in parts if p).strip()
            if not content:
                continue
            ts = msg.get("create_time")
            timestamp = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else None
            turns.append(TranscriptTurn(role=role, content=content, timestamp=timestamp))
    return turns


def import_transcript_file(
    conn: sqlite3.Connection,
    path: str | Path,
    assistant: str,
    evidence_source: str | None = None,
) -> TranscriptImportResult:
    """Parse a transcript file and create NEEDS_REVIEW attributions for trade matches."""
    _require_valid_assistant(assistant)
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(path)
    evidence_source = evidence_source or path.name
    text = path.read_text(encoding="utf-8")
    fmt = "chatgpt_json" if path.suffix.lower() == ".json" else "plain"
    return import_transcript_text(conn, text, assistant, evidence_source, fmt=fmt)


def import_transcript_text(
    conn: sqlite3.Connection,
    text: str,
    assistant: str,
    evidence_source: str,
    fmt: str = "plain",
) -> TranscriptImportResult:
    """Parse transcript text and create NEEDS_REVIEW attributions. Used by Streamlit uploads."""
    _require_valid_assistant(assistant)
    if fmt == "chatgpt_json":
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Not valid JSON: {exc}") from exc
        turns = parse_chatgpt_json_turns(data)
    else:
        turns = parse_transcript_turns(text)
    return _create_attributions_from_turns(conn, turns, assistant, evidence_source)


# ── Internal helpers ────────────────────────────────────────────────────────────

def _require_valid_assistant(assistant: str) -> None:
    if assistant not in ASSISTANTS:
        raise ValueError(f"assistant must be one of: {', '.join(sorted(ASSISTANTS))}")


def _bfs_chatgpt_nodes(mapping: dict) -> list[dict]:
    """BFS traversal of ChatGPT mapping — visits all branches, not just the final one."""
    roots = [
        node for node in mapping.values()
        if not node.get("parent") or node["parent"] not in mapping
    ]
    ordered: list[dict] = []
    queue = list(roots)
    while queue:
        node = queue.pop(0)
        ordered.append(node)
        for child_id in node.get("children") or []:
            if child_id in mapping:
                queue.append(mapping[child_id])
    return ordered


def _create_attributions_from_turns(
    conn: sqlite3.Connection,
    turns: list[TranscriptTurn],
    assistant: str,
    evidence_source: str,
) -> TranscriptImportResult:
    result = TranscriptImportResult(turns_parsed=len(turns))
    trades = _load_trade_targets(conn)
    if not trades:
        return result

    existing_keys = _load_existing_attribution_keys(conn, evidence_source)
    for turn in turns:
        if turn.role != "assistant":
            continue
        result.assistant_turns += 1
        for match in _find_matches(turn.content, trades):
            result.matches_found += 1
            key = match["trade_id"]
            if key in existing_keys:
                result.duplicates_skipped += 1
                continue
            try:
                add_assistant_attribution(
                    conn,
                    trade_id=match["trade_id"],
                    assistant=assistant,
                    attribution="UNCLEAR",
                    evidence=match["evidence"],
                    evidence_source=evidence_source,
                    match_quality=match["match_quality"],
                    review_status="NEEDS_REVIEW",
                )
                existing_keys.add(key)
                result.attributions_created += 1
            except Exception as exc:
                result.errors.append(f"trade {match['trade_id']}: {exc}")
    return result


def _load_trade_targets(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT trade_id, market_slug, market_title FROM trades_raw").fetchall()
    return [dict(r) for r in rows]


def _load_existing_attribution_keys(conn: sqlite3.Connection, evidence_source: str) -> set[str]:
    rows = conn.execute(
        "SELECT trade_id FROM assistant_attributions WHERE evidence_source = ? AND trade_id IS NOT NULL",
        (evidence_source,),
    ).fetchall()
    return {r[0] for r in rows}


def _find_matches(content: str, trades: list[dict[str, Any]]) -> list[dict[str, Any]]:
    lower = content.lower()
    seen: set[str] = set()
    matches: list[dict[str, Any]] = []

    for trade in trades:
        trade_id = trade["trade_id"]
        if trade_id in seen:
            continue

        slug = (trade.get("market_slug") or "").strip()
        title = (trade.get("market_title") or "").strip()
        match_quality = 0.0
        matched_needle = ""

        if slug:
            if slug.lower() in lower:
                match_quality, matched_needle = 0.9, slug
            elif slug.replace("-", " ").lower() in lower:
                match_quality, matched_needle = 0.85, slug.replace("-", " ")

        if match_quality == 0.0 and title:
            if title.lower() in lower:
                match_quality, matched_needle = 0.8, title
            else:
                keywords = _extract_keywords(title)
                if len(keywords) >= 2:
                    found = [kw for kw in keywords if kw in lower]
                    if len(found) >= 2:
                        match_quality = round(0.4 + 0.1 * min(len(found), 4), 2)
                        matched_needle = found[0]

        if match_quality > 0.0:
            matches.append({
                "trade_id": trade_id,
                "market_slug": slug,
                "market_title": title,
                "evidence": _extract_evidence(content, matched_needle),
                "match_quality": match_quality,
            })
            seen.add(trade_id)

    return matches


def _extract_keywords(title: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", title.lower())
    return [w for w in words if w not in _STOP_WORDS and len(w) > 2]


def _extract_evidence(text: str, needle: str, window: int = 300) -> str:
    lower = text.lower()
    idx = lower.find(needle.lower())
    if idx == -1:
        return text[:500]
    start = max(0, idx - window // 2)
    end = min(len(text), idx + len(needle) + window // 2)
    excerpt = text[start:end].strip()
    if start > 0:
        excerpt = "…" + excerpt
    if end < len(text):
        excerpt = excerpt + "…"
    return excerpt
