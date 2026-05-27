# Polygraph

Polygraph is a local-first Polymarket trade ledger and post-mortem system. It imports CSV trade exports into SQLite, keeps raw fills immutable, links fills to user decisions, and stores GPT/Claude attribution as annotations.

Polygraph is not a trading bot. It does not place, cancel, recommend, scrape, or interact with live orders.

## Install

```bash
python3.11 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
```

## Initialize The Database

The database is created automatically at `data/processed/polygraph.sqlite` when the app or services connect:

```bash
python -c "from ledger.db import connect_db; connect_db()"
```

## Import Trades

Place Polymarket CSV exports in `data/raw_exports/`, then run the Streamlit app:

```bash
streamlit run app/streamlit_app.py
```

Open the Import Trades tab, select a CSV, and import it. Re-importing the same file safely skips duplicate rows by `source_row_hash`.

Programmatic import:

```python
from ledger.db import connect_db
from ledger.import_trades import import_trades_csv

conn = connect_db()
result = import_trades_csv(conn, "data/raw_exports/my_export.csv")
print(result)
```

## Create Decisions

Decisions are user annotations for actual trading ideas or rationales. They can be edited because they do not mutate raw imported fills.

```python
from ledger.services import create_decision

decision = create_decision(
    conn,
    project="GEO_OIL",
    sleeve="main",
    market_slug="example-market",
    outcome="Yes",
    side="BUY",
    thesis_summary="Reason for the trade.",
)
```

Allowed projects are `GEO_OIL`, `ELECTIONS`, `SPORTS_MM`, `SPORTS_DIRECTIONAL`, `EXPERIMENTAL`, and `CASH`.

## Link Trades

One decision can cover many fills, and one fill can be linked to multiple decisions. Links are stored separately from `trades_raw`.

```python
from ledger.services import link_trades_to_decision

link_trades_to_decision(conn, ["trd_..."], decision["decision_id"], 1.0, "USER")
```

The Unlinked Trades tab also shows simple grouping suggestions based on market, outcome, side/action, timestamp proximity, and similar price. Suggestions never auto-confirm links.

## GPT/Claude Attribution

Assistant attribution lives in `assistant_attributions`. It can reference a trade, a decision, or both. It must use one of the allowed assistants and attribution values.

Allowed assistants: `GPT`, `CLAUDE`, `GROK`, `USER`.

Allowed attribution values: `DIRECT_RECOMMENDATION`, `SUPPORTED_AFTER_REVIEW`, `OPPOSED`, `MENTIONED_BUT_NOT_RECOMMENDED`, `NO_MATCH_FOUND`, `NOT_INVOLVED`, `UNCLEAR`.

The normal workflow is:

1. Export an attribution packet for a trade or decision.
2. Paste it into GPT or Claude with `prompts/attribution_prompt.md`.
3. Save the returned JSON as an attribution annotation.
4. Mark review status as `USER_CONFIRMED`, `REJECTED`, or `NEEDS_REVIEW`.

## Export Review Packets

Use the Export Review Packets tab or call:

```python
from ledger.export_packets import export_attribution_packet, export_postmortem_packet

markdown = export_attribution_packet(conn, trade_id="trd_...")
postmortem = export_postmortem_packet(conn, decision_id="dec_...")
```

Generated packets can be saved to `data/processed/`.

## MCP Path Later

The service functions in `ledger/services.py`, `ledger/import_trades.py`, `ledger/grouping.py`, and `ledger/export_packets.py` are intentionally plain Python functions. A later MCP layer can expose read tools, controlled annotation write tools, packet exports, and transcript import without changing the raw trade immutability model.

## Tests

```bash
pytest
```

Tests use temporary SQLite databases and do not require network access.

## V2 TODO

- Transcript import
- MCP read tools
- MCP controlled write tools
- Google Sheets export
