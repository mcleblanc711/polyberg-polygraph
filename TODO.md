# TODO

## V2 Backlog

### Done
- MCP read tools (`mcp_server/server.py` — 10 tools, wired via `.claude/settings.json`)

### Up Next
- Transcript import (`ledger/transcript_import.py`)
  - Parse plain text and ChatGPT JSON export formats
  - Match assistant turns to known trades by market slug/title
  - Create `NEEDS_REVIEW` attribution records with extracted evidence
  - New Streamlit tab + tests

### Later
- MCP controlled write tools (design after transcript import reveals write patterns)
- Google Sheets export
- Sports paper-trading module
