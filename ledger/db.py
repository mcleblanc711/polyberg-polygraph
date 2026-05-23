"""SQLite connection and schema setup."""

from __future__ import annotations

import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = Path("data/processed/polygraph.sqlite")


def connect_db(db_path: str | Path = DEFAULT_DB_PATH, initialize: bool = True) -> sqlite3.Connection:
    path = Path(db_path)
    if str(path) != ":memory:":
        path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    if initialize:
        init_db(conn)
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS trades_raw (
            trade_id TEXT PRIMARY KEY,
            source_row_hash TEXT UNIQUE NOT NULL,
            imported_at TEXT NOT NULL,
            source_file TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            market_slug TEXT,
            market_title TEXT,
            outcome TEXT NOT NULL,
            side TEXT,
            action TEXT,
            price REAL NOT NULL,
            shares REAL NOT NULL,
            notional REAL,
            fees REAL DEFAULT 0,
            raw_json TEXT NOT NULL
        );

        CREATE TRIGGER IF NOT EXISTS trades_raw_no_update
        BEFORE UPDATE ON trades_raw
        BEGIN
            SELECT RAISE(ABORT, 'trades_raw is append-only');
        END;

        CREATE TRIGGER IF NOT EXISTS trades_raw_no_delete
        BEFORE DELETE ON trades_raw
        BEGIN
            SELECT RAISE(ABORT, 'trades_raw is append-only');
        END;

        CREATE TABLE IF NOT EXISTS decisions (
            decision_id TEXT PRIMARY KEY,
            decision_timestamp TEXT NOT NULL,
            project TEXT NOT NULL,
            sleeve TEXT,
            market_slug TEXT,
            market_title TEXT,
            outcome TEXT,
            side TEXT,
            intent TEXT,
            decision_type TEXT,
            price_used REAL,
            target_entry TEXT,
            target_exit TEXT,
            max_allocation REAL,
            thesis_summary TEXT,
            rule_summary TEXT,
            catalyst TEXT,
            invalidation TEXT,
            user_notes TEXT,
            status TEXT
        );

        CREATE TABLE IF NOT EXISTS trade_decision_links (
            trade_id TEXT NOT NULL,
            decision_id TEXT NOT NULL,
            link_confidence REAL NOT NULL,
            link_method TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY(trade_id, decision_id),
            FOREIGN KEY(trade_id) REFERENCES trades_raw(trade_id),
            FOREIGN KEY(decision_id) REFERENCES decisions(decision_id)
        );

        CREATE TABLE IF NOT EXISTS assistant_attributions (
            attribution_id TEXT PRIMARY KEY,
            trade_id TEXT,
            decision_id TEXT,
            assistant TEXT NOT NULL,
            attribution TEXT NOT NULL,
            evidence TEXT,
            evidence_source TEXT,
            recommended_price REAL,
            recommended_size REAL,
            match_quality REAL NOT NULL,
            review_status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            CHECK (trade_id IS NOT NULL OR decision_id IS NOT NULL),
            FOREIGN KEY(trade_id) REFERENCES trades_raw(trade_id),
            FOREIGN KEY(decision_id) REFERENCES decisions(decision_id)
        );

        CREATE TABLE IF NOT EXISTS postmortems (
            postmortem_id TEXT PRIMARY KEY,
            decision_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            pnl REAL,
            thesis_quality TEXT,
            execution_quality TEXT,
            sizing_quality TEXT,
            exit_quality TEXT,
            rule_read_quality TEXT,
            primary_error_type TEXT,
            secondary_error_type TEXT,
            what_went_right TEXT,
            what_went_wrong TEXT,
            lesson_keep TEXT,
            lesson_change TEXT,
            never_repeat TEXT,
            future_rule TEXT,
            markdown_body TEXT,
            FOREIGN KEY(decision_id) REFERENCES decisions(decision_id)
        );
        """
    )
    conn.commit()
