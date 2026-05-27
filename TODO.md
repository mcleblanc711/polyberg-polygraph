# TODO

## V2 Backlog

### Done
- MCP read tools (`mcp_server/server.py` — 10 tools, wired via `.claude/settings.json`)
- Transcript import (`ledger/transcript_import.py`)
  - Plain text (Human/Assistant, You/ChatGPT, User/Claude labels) and ChatGPT JSON export
  - Matches assistant turns to trades by slug (exact/hyphen-normalized) and title keywords
  - Creates `NEEDS_REVIEW` attributions with evidence excerpt and match_quality (0.4–0.9)
  - Deduplicates on (evidence_source, trade_id) — safe to re-import same file
  - Streamlit "Import Transcripts" tab; 16 new tests, 25 total passing

- Google Sheets export (`ledger/sheets_export.py`)
  - Service account JSON auth via `gspread`; install with `pip install '.[sheets]'`
  - `export_to_sheets(conn, spreadsheet_id_or_url, credentials_path)` — overwrites 4 worksheets: Trades, Decisions, Attributions, Postmortems
  - Streamlit "Export to Sheets" tab (tab 9); graceful degradation if gspread not installed
  - 8 new tests, 33 total passing

