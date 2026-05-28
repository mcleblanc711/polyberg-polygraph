# Handoff: Polygraph UI

> Replaces the Streamlit-based interface in **mcleblanc711/polyberg-polygraph** with a polyberg-style terminal UI. All 10 tabs faithful to `app/streamlit_app.py` and the service functions in `ledger/services.py` (as of commit `a678f544`).

---

## Overview

Polygraph is a local-first Polymarket trade ledger and post-mortem system. The Python backend (SQLite + service functions) is finished and stable. This design is a **replacement front-end** for `app/streamlit_app.py` — same 10 tabs, same data flows, but rendered as a single-page terminal UI instead of stacked Streamlit widgets.

Nothing in the Python `ledger/` package needs to change. Every screen here maps to a function that already exists.

## About the design files

The files in this bundle are **HTML/JSX prototypes** built to demonstrate look, behavior and information architecture — they're not production code. They use React 18 via `<script type="text/babel">` inline transpilation, which is fine for a design doc but inappropriate to ship.

**Task:** recreate these designs in the target stack. The Python backend is Streamlit today; the cleanest replacement is a small Python web framework (FastAPI + a SPA) or a Streamlit-with-a-real-frontend approach. Reasonable options:

1. **FastAPI + Vite + React** — wrap the existing `ledger.services` functions in FastAPI endpoints, ship the SPA from the same Python project. Best fit.
2. **Streamlit Components** — embed React components inside the existing Streamlit shell. Lowest churn but the multi-tab terminal feel will fight Streamlit's container model.
3. **Reflex / NiceGUI** — Python-native reactive UI. Lower velocity for this density but keeps the stack monolingual.

Pick one and apply the codebase's existing patterns (typing, packaging, testing). Don't lift the inline-Babel scaffolding.

## Fidelity

**Hi-fi.** Colors, typography, spacing, and interactions are final. Recreate pixel-perfectly using the chosen stack's primitives. Match every chip, every status-bar item, every column. The terminal feel is load-bearing — it makes the immutability of `trades_raw` visually obvious.

## Screenshots

One per tab, 1440 × 900, in [`screenshots/`](./screenshots):

| # | Tab | File |
|---|-----|------|
| 0 | Import Trades | `screenshots/00-import.png` |
| 1 | Import Transcripts | `screenshots/01-transcripts.png` |
| 2 | Trade Ledger | `screenshots/02-ledger.png` |
| 3 | Unlinked Trades | `screenshots/03-unlinked.png` |
| 4 | Decisions | `screenshots/04-decisions.png` |
| 5 | Assistant Attribution | `screenshots/05-attribution.png` |
| 6 | Post-Mortems | `screenshots/06-postmortems.png` |
| 7 | Export Review Packets | `screenshots/07-packets.png` |
| 8 | Export to Sheets | `screenshots/08-sheets.png` |
| 9 | Attribution Prompt | `screenshots/09-attribution-prompt.png` |

---

## Screens / Views

The app is a single full-viewport shell:

```
┌─────────────────────────────────────────────────────────────────────┐
│ TOPBAR · brand · tab nav (10) · search · mode badge · primary CTAs │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                          ACTIVE SCREEN                              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ STATUSBAR · sqlite path · APPEND-ONLY badge · counts · NEEDS_REVIEW │
└─────────────────────────────────────────────────────────────────────┘
```

### Shell — TopBar + StatusBar

**TopBar** (`app.jsx → TopBar`)
- Brand block: `LogoMark` (magenta peak SVG, 14px), `p0lygraph / ledger` wordmark, version `v0.1.0`
- Tab nav: 10 tabs (see below); active tab gets a magenta underline; tabs with work get a numeric badge (`UNLINKED`, `ATTRIBUTION`, `POST-MORTEMS`)
- Right cluster: search input with `⌘K` kbd, `LOCAL · APPEND-ONLY` mode pill (cyan dot), `$ IMPORT_CSV` ghost button, `RUN NEXT REVIEW ▸` primary button

**StatusBar** (`app.jsx → StatusBar`)
- `SQLITE · data/processed/polygraph.sqlite`
- `● trades_raw LOCKED · APPEND-ONLY` (cyan)
- Active screen indicator
- Counts: `N FILLS · N DECISIONS · N ATTRIBUTIONS · N POST-MORTEMS`
- `dedupe by source_row_hash ✓`
- `● N NEEDS_REVIEW` (amber, only when > 0)

### The 10 tabs

| # | Screen | File | Maps to |
|---|--------|------|---------|
| 0 | **IMPORT** | `screen-postmortems.jsx → ImportTrades` | `import_trades_csv()` → `ImportResult` |
| 1 | **TRANSCRIPTS** | `screen-transcripts.jsx` | `transcript_import.import_transcript_text()` |
| 2 | **LEDGER** | `screen-ledger.jsx → TradeLedger` | `services.fetch_trades(project, market_text, outcome, side, action, linked)` |
| 3 | **UNLINKED** | `screen-ledger.jsx → UnlinkedTrades` | `fetch_unlinked_trades()` + `grouping.suggest_candidate_groups()` + `link_trades_to_decision()` |
| 4 | **DECISIONS** | `screen-decisions.jsx → Decisions` | `create_decision` / `edit_decision` / `fetch_decisions` / `get_linked_trades` |
| 5 | **ATTRIBUTION** | `screen-decisions.jsx → Attribution` | `add_assistant_attribution` / `mark_attribution_review_status` / `get_attributions_for_(trade\|decision)` |
| 6 | **POST-MORTEMS** | `screen-postmortems.jsx → PostMortems` | `create_or_update_postmortem` / `get_postmortems` |
| 7 | **PACKETS** | `screen-postmortems.jsx → ExportPackets` | `export_attribution_packet` / `export_postmortem_packet` / `save_packet` |
| 8 | **SHEETS** | `screen-sheets.jsx → ExportToSheets` | `sheets_export.export_to_sheets` (gspread, optional dep) |
| 9 | **ATTR PROMPT** | `screen-attribution-prompt.jsx` | `attribution_prompt.generate_attribution_prompt(trades)` |

Each screen has a header strip (`screen-hd`) with `// tabs[n] · …` breadcrumb, a large screen title, and a one-line description. Below that, screen-specific content.

---

### Tab 0 · IMPORT TRADES

3-stage flow: **DROP → PREVIEW → DONE**.

- **DROP** stage: large dropzone with placeholder copy, lists last import (filename, timestamp, `+N` new). Schema target line spells out the trades_raw columns.
- **PREVIEW** stage: column-mapping table (CSV column → `trades_raw` field → sample); 4-stat row (`rows_seen`, `rows_imported`, `duplicates_skipped`, `errors`); amber `trades_raw_no_update / trades_raw_no_delete triggers fire on any attempt to mutate` callout; `COMMIT` and `CANCEL` buttons.
- **DONE** stage: success state shows an `ImportResult` JSON snippet, then `REVIEW UNLINKED (N)` primary CTA, `OPEN LEDGER`, `IMPORT ANOTHER`.
- Below the workflow: **recent import runs** table (imported_at, source_file, seen, +imported, dupes, errors).

### Tab 1 · IMPORT TRANSCRIPTS (NEW)

3-stage flow: **DROP → PREVIEW → DONE**.

- **DROP**: dropzone accepting `.txt / .md / .json`; recognises `Human:/Assistant:`, `You/ChatGPT`, `User/Claude`; assistant picker (`ASSISTANTS` enum: GPT, CLAUDE, GROK, USER); auto-detected fmt (`plain` vs `chatgpt_json`); recent transcript runs table.
- **PREVIEW**: source + assistant summary cards; 3-stat row (`turns_parsed`, `assistant_turns`, `matches_found`); two-pane: parsed turns list on the left (Human turns dim, Assistant turns magenta, MATCH chip on matched turns), matches → NEEDS_REVIEW attributions cards on the right (target kind = TRADE or DECISION, market_slug, attribution value, `match_q` 0.40–0.90, method = `slug_exact` or `title_keyword`); amber `nothing is auto-confirmed` callout; commit / cancel.
- **DONE**: success state with `TranscriptImportResult` JSON, `REVIEW IN ATTRIBUTION QUEUE` CTA.

### Tab 2 · TRADE LEDGER

Header row: title, immutable badge, `EXPORT REVIEW PACKET` + `IMPORT CSV` buttons.

Filter bar (mirrors `fetch_trades` signature):
- Market contains (text)
- Project select (the 6 enum values)
- Outcome (Yes/No/any)
- Side (BUY/SELL/any)
- Action (TRADE/REDEMPTION/MERGE/SPLIT/any)
- Link status (all/linked/unlinked)

Table columns: `timestamp · trade_id · project · sleeve · market (title + slug) · out · side · action · price · shares · notional · fees · linked decision · attr count`. Click a row → right-side **drawer** showing:
1. Full `trades_raw` row (immutable; all 13 columns shown)
2. `trade_decision_links` table for this trade
3. Trade-level `assistant_attributions` rows (transcript-sourced are the typical case)

### Tab 3 · UNLINKED TRADES

Top: full unlinked-fills table with row-level checkboxes, `select all` / `clear`.

Middle: **suggested groups** table — clusters by `(market_slug, outcome, side, action)`. Each row has fills count, avg px, notional sum, and a `select group` button that pre-fills the checkbox set.

Bottom: **link form** (mirrors `link_trades_to_decision(conn, trade_ids, decision_id, link_confidence, link_method)`):
- decision_id select (lists all decisions)
- `link_confidence` slider (0.0–1.0, step 0.05)
- `link_method` select (USER, SUGGESTED)
- `LINK N` primary button (disabled when no trades selected)
- `+ CREATE DECISION & LINK` ghost button

### Tab 4 · DECISIONS

Two-pane layout:
- **LEFT**: scrolling list of decisions, newest first. Each row: short decision_id, status chip, project + sleeve chips, side/outcome/price, market title (truncated), fills + attr counts, PnL (from linked post-mortem if present).
- **RIGHT**: detail pane OR create-decision form.

Detail pane mirrors all `DECISION_FIELDS` from `services.py`:
- Header: id, project, sleeve, status, big side/outcome/price stat, market title + slug; right-side PnL stat or "no post-mortem" state
- Read-only metadata grid: intent, decision_type, target_entry, target_exit, max_allocation (% NAV), decision_timestamp
- Editable text areas: thesis_summary, rule_summary, catalyst, invalidation (amber accent), user_notes
- `assistant_attributions` mini-table (assistant, attribution, match_q, review_status, evidence_source)
- `trade_decision_links` mini-table (trade_id, ts, side/out, price, shares, notional, link_conf)

Create form covers every `create_decision()` keyword arg.

### Tab 5 · ASSISTANT ATTRIBUTION

Three-column layout:
- **LEFT (380px)**: pivot toggle (ALL / TRADE / DECISION), assistant filter, attribution-value filter, review-status filter, then a scrolling queue of attribution rows. Each card shows short attribution_id, review_status, assistant chip, attribution value, subject (trd_/dec_ short id), match_q %.
- **CENTER**: editor. Subject context card (decision OR trade preview, link to navigate). Attribution-value picker (7 buttons, big grid). Review_status picker (5 buttons). Match_quality slider (0.00–1.00). recommended_price / recommended_size numeric inputs. evidence_source text input. evidence textarea. Action buttons: `CONFIRM` / `REJECT` / `SAVE DRAFT`.
- **RIGHT (360px)**: legend cards — attribution vocabulary, the critical `NO_MATCH_FOUND` vs `NOT_INVOLVED` distinction (amber-bordered), review_status workflow reference.

### Tab 6 · POST-MORTEMS

Sub-tabs at top: `pending (N)` · `completed (N)` · `editor`.

**Pending**: cards for resolved decisions without a post-mortem; `WRITE POST-MORTEM` button jumps to editor.

**Completed**: cards summarising existing post-mortems (PnL, 5 quality chips, primary/secondary error code chips).

**Editor**: two-column split.
- **LEFT (form)**:
  - Header strip with decision id, status, save/export/commit buttons
  - Read-only sections pulled from the decision: raw context, original thesis_summary, rule_summary + invalidation
  - PnL numeric input (with live formatted display)
  - 5 quality dimensions, each as a 5-button picker (`EXCELLENT / GOOD / OK / POOR / BAD`) — the values are TEXT, not 1–5 stars
  - Error-type picker spanning all 26 `REASON_ERROR_CODES` grouped into 6 sections (setup / exit / process error / emotional / outcome / external). Two slot buttons toggle whether you're picking the primary or secondary error code. Selected codes get a magenta (primary) or cyan (secondary) highlight.
  - Six narrative textareas: `what_went_right`, `what_went_wrong`, `lesson_keep`, `lesson_change`, `never_repeat`, `future_rule`
- **RIGHT**: live `markdown_body` preview (regenerated on every keystroke) — this is what gets saved into the `postmortems.markdown_body` column.

### Tab 7 · EXPORT REVIEW PACKETS

Two-column layout.
- **LEFT (config)**:
  - Packet type: ATTRIBUTION (with signature `export_attribution_packet(conn, trade_id | decision_id)`) or POSTMORTEM (`export_postmortem_packet(conn, decision_id)`)
  - For ATTRIBUTION: trade_id select + decision_id select (at least one required)
  - For POSTMORTEM: decision_id select
  - Actions: `COPY MARKDOWN`, `SAVE → data/processed/{filename}.md`, `OPEN_IN_GPT`, `OPEN_IN_CLAUDE`
- **RIGHT (preview)**: rendered markdown packet with char + token count. Format matches what the Python `export_packets.py` actually produces — sections include trade or decision context, thesis, rule, catalyst, invalidation, and a return-shape JSON block.

### Tab 8 · EXPORT TO SHEETS (NEW)

3-stage flow: **CONFIGURE → CONFIRM → DONE**.

- gspread availability guard at top (`pip install 'polyberg-polygraph[sheets]'` if missing) with a "simulate install" affordance in the prototype
- CONFIGURE: spreadsheet URL/ID input (auto-extracts id from a Google Sheets URL), service-account credentials JSON path input, "will overwrite" table summarising row counts per worksheet, amber warning that the service-account email needs editor access
- CONFIRM: read-only summary of what will run
- DONE: returned dict `{Trades: N, Decisions: N, Attributions: N, Postmortems: N}` rendered as JSON; `OPEN IN GOOGLE SHEETS` deep link
- **RIGHT pane**: per-worksheet schema preview (first 5 rows of each)
- Below the workflow: export history table

### Tab 9 · ATTRIBUTION PROMPT (NEWEST)

Two-column layout.
- **LEFT (config)**:
  - Date range as 4 big-pick buttons: `Last 30 days` (default), `Last 90 days`, `Last 365 days`, `All time`
  - Preview-range card: trades in window, days_back value, sort order note
  - Actions: `GENERATE PROMPT`, `DOWNLOAD attribution_prompt.txt`, `COPY ALL`
  - Amber callout distinguishing this bulk sweep from per-decision packets
- **RIGHT (preview)**: first 100 lines of the generated markdown, char + line count. Output matches `attribution_prompt.generate_attribution_prompt()`:
  ```
  # Polymarket Trade Attribution

  For each trade you recognise from our conversations, reply with:
  CLAUDE | GPT | USER (your own call) | MIXED
  Leave blank anything you don't recognise.

  ---

  ## 2026-05-22  (2 trades)

    14:03  Hormuz remains operationally normal…  |  No  Trade  $0.360  × 128  ($46.00)  |  ___________
    14:05  Hormuz remains operationally normal…  |  No  Trade  $0.350  × 82  ($28.84)  |  ___________
  ```
- Below: reply-key panel explaining the 4 labels and pointing at `prompts/attribution_prompt.md` as the matching system prompt.

---

## Interactions & Behavior

- **Tab nav** — clicking a tab swaps the active screen; no route changes, no animation
- **Drawer** (used on Ledger trade rows) — slides in from the right, 480px wide; backdrop dims body; click backdrop or `✕ CLOSE` to dismiss
- **Stat cards** with `onClick` → navigate to drill screen
- **Three-stage workflows** (Import, Transcripts, Sheets) — buttons advance through stages; CANCEL or back-button returns to start
- **Live previews** — every textarea/input in the Post-Mortem editor and Attribution Prompt regenerates the right-pane preview on change
- **Download** — Attribution Prompt's download builds a Blob and triggers an `<a download>` click
- **Copy to clipboard** — `navigator.clipboard.writeText(...)`; brief `✓ COPIED` confirmation
- No real persistence in the prototype; the production target wires every action to its `ledger.services` function

### State management

Local React `useState` per screen. In the target app, expect:
- Tab state (which screen is active) — single source of truth; could live in URL
- Per-tab form state — bounded to that tab
- Selection drawers / focused row — local
- All persistence is a request to the FastAPI/Streamlit Python backend; backend hits `ledger.services` and SQLite

---

## Design Tokens

Pulled from `styles.css → :root`.

### Colors

| token | hex | role |
|-------|-----|------|
| `--bg-0` | `#030004` | canvas background (deep purple-black) |
| `--bg-1` | `#070005` | panel |
| `--bg-2` | `#0e0009` | raised |
| `--bg-3` | `#16000d` | hover |
| `--bg-4` | `#1f0014` | active |
| `--border-0` | `#1a0512` | hairline |
| `--border-1` | `#2a0928` | standard |
| `--border-2` | `#3d1238` | emphasis |
| `--text-0` | `#f0e8f5` | primary |
| `--text-1` | `#cdb8ce` | secondary |
| `--text-2` | `#a08aa0` | dim |
| `--text-3` | `#7a5e7a` | mute |
| `--text-4` | `#4a3a4a` | disabled |
| `--magenta` | `#ff3df0` | brand (editable rows, focus, active tab, brand stat) |
| `--cyan` | `#00ffd1` | brand-2 (positive PnL, confirmed status, OK rating) |
| `--red` | `#ff3d6b` | negative PnL, REJECTED, BAD rating |
| `--amber` | `#ffb420` | warnings, NEEDS_REVIEW, MIXED, invalidation accents |
| `--gpt` | `#5cf3d3` | GPT assistant accent |
| `--claude` | `#c8a8ff` | Claude assistant accent |
| `--yes` | `#00ffd1` | Yes outcome |
| `--no` | `#ff3d6b` | No outcome |

### Typography

| token | family | usage |
|-------|--------|-------|
| `--font-display` | `"Space Grotesk", system-ui, sans-serif` | display headings |
| `--font-sans` | `"Inter", system-ui, sans-serif` | prose, form labels |
| `--font-mono` | `"JetBrains Mono", ui-monospace, …` | every id, every code, every number |

Body baseline: 13px / line-height 1.5. Mono text typically 10–12px with `letter-spacing: 0.04em–0.14em` depending on role. Stat numerics are 18–36px mono. Section labels use `// section name` (mono, 11px, dim, lowercase, magenta `//` prefix).

### Spacing

`--u: 4px` is the base. Use 4 / 8 / 12 / 16 / 20 / 24 multiples. Row heights:
- `--row-h: 28px` (dense default)
- `--row-h-comfy: 36px`

Density modes (`density-minimal | dense | comfy`) are toggleable; minimal is the design default.

### Borders, radius, shadow

- Borders are 1px hairlines, never rounded (radius 0 throughout). Magenta-tinted edge on hover / focus.
- Drawer has a `box-shadow: -20px 0 40px rgba(0,0,0,0.6)`.
- Cards use cut-corner clip-paths for one or two key surfaces: `--clip-card` (12px), `--clip-card-sm` (8px).

### Chip vocabulary (`components.jsx → Chip` + `AttrChip`)

Variants by `kind`:
- `yes` (cyan) · `no` (red) · `pos` (cyan) · `neg` (red)
- `warn` (amber) · `immutable` (magenta-outlined)
- `gpt` (cyan-mint) · `claude` (purple)
- `draft` · `proposed` · `confirmed` · `rejected` · `needs-rev`

`AttrChip` maps the 7 ATTRIBUTIONS enum values to glyph + label + kind. Includes a `compact` mode and a `proposed` dashed-border style for `MODEL_PROPOSED` status.

---

## Controlled vocabularies (must match `ledger/enums.py`)

```python
PROJECTS = {"GEO_OIL", "ELECTIONS", "SPORTS_MM", "SPORTS_DIRECTIONAL", "EXPERIMENTAL", "CASH"}
ASSISTANTS = {"GPT", "CLAUDE", "GROK", "USER"}
ATTRIBUTIONS = {"DIRECT_RECOMMENDATION", "SUPPORTED_AFTER_REVIEW", "OPPOSED",
                "MENTIONED_BUT_NOT_RECOMMENDED", "NO_MATCH_FOUND",
                "NOT_INVOLVED", "UNCLEAR"}
REVIEW_STATUSES = {"DRAFT", "MODEL_PROPOSED", "USER_CONFIRMED", "REJECTED", "NEEDS_REVIEW"}
REASON_ERROR_CODES = {  # 26 codes — grouped in the UI as setup/exit/process/emotional/outcome/external
    "RULE_ARB", "CLEAN_ORACLE_NO", "HEADLINE_OVERSHOOT", "FAST_INFO_REPRICE",
    "MODEL_EDGE", "SPREAD_CAPTURE", "HEDGE", "LOTTERY", "MISTAKE_FIX",
    "THESIS_INVALIDATED", "PROFIT_TAKE",
    "BAD_RULE_READ", "BAD_FACTS", "BAD_MODEL", "BAD_PRICE", "BAD_SIZE",
    "BAD_TIMING", "BAD_EXIT", "BAD_CORRELATION", "ADVERSE_SELECTION",
    "EMOTIONAL_TRADE", "FOMO", "REVENGE_TRADE",
    "GOOD_PROCESS_BAD_RESULT", "BAD_PROCESS_GOOD_RESULT",
    "PLATFORM_OR_RESOLUTION_WEIRDNESS",
}
```

`mock.jsx` re-declares these as `MOCK.PROJECTS`, `MOCK.ASSISTANTS`, etc. Replace by importing the real enums via the backend.

## Tables (already exist in `ledger/db.py`)

- `trades_raw` — APPEND-ONLY; SQLite triggers `trades_raw_no_update` and `trades_raw_no_delete` block any mutation. Dedupe by `source_row_hash UNIQUE`.
- `decisions` — editable; all `DECISION_FIELDS` from `services.py` are exposed in the Decisions tab.
- `trade_decision_links` — composite PK `(trade_id, decision_id)`; many-to-many; carries `link_confidence` (0–1) and `link_method` ("USER" / "SUGGESTED" / etc).
- `assistant_attributions` — at least one of `trade_id` / `decision_id` (CHECK constraint); `match_quality` 0–1; `review_status` enum.
- `postmortems` — one current row per `decision_id`; rich narrative fields.

---

## Assets

- **Fonts**: Inter, JetBrains Mono, Space Grotesk — all from Google Fonts. No bundled assets.
- **Logo**: inline SVG (`components.jsx → LogoMark`) — a magenta polyberg-style peak/wave line. Use as-is or refine.
- **No images**. The aesthetic is intentionally text-and-glyph-only.

---

## Files in this bundle

| file | role |
|------|------|
| `index.html` | scaffold — pins React 18 + Babel, loads all jsx in order, wires the design canvas + tweaks panel |
| `app.jsx` | App shell — NAV array, TopBar, StatusBar, screen router |
| `mock.jsx` | All mock data + helpers — every record matches the real SQL schema |
| `components.jsx` | Shared components: `Chip`, `AttrChip`, `Btn`, `CmdBtn`, `StatCard`, `SectionH`, `IdMono`, `ReviewStatus`, `Empty`, `Drawer`, `LogoMark`, `MiniTrace`, `Sparkline`, `HBar`, `PolygraphWaveform` |
| `design-canvas.jsx` | Canvas tooling — not part of the production app, only the design doc |
| `tweaks-panel.jsx` | Canvas tooling — accent + density + start-tab tweaks |
| `screen-postmortems.jsx` | **THREE screens** — `ImportTrades` (tab 0), `PostMortems` (tab 6), `ExportPackets` (tab 7) |
| `screen-transcripts.jsx` | `ImportTranscripts` (tab 1) |
| `screen-ledger.jsx` | `TradeLedger` (tab 2) + `UnlinkedTrades` (tab 3) |
| `screen-decisions.jsx` | `Decisions` (tab 4) + `Attribution` (tab 5) |
| `screen-sheets.jsx` | `ExportToSheets` (tab 8) |
| `screen-attribution-prompt.jsx` | `AttributionPrompt` (tab 9) |
| `styles.css` | All design tokens + layout primitives |
| `app.css` | Shell-specific styles (topbar, statusbar, tabs, panels, tables, forms) |

To run the design doc locally: serve the folder over any static HTTP server (`python -m http.server` is fine) and open `index.html`. Don't run from `file://` — Babel inline transpilation needs http.

## Hard constraints (don't ship without these)

1. `trades_raw` mutations must be **impossible** through the UI — there is no edit affordance anywhere on raw fill data. The schema enforces it via triggers; the UI mirrors the constraint by simply omitting edit buttons.
2. Transcript-sourced attributions must always land as `NEEDS_REVIEW`, never auto-confirmed. `match_quality` strictly inside `[0.4, 0.9]` for matches; `1.0` only for `NO_MATCH_FOUND` and `NOT_INVOLVED`.
3. `NO_MATCH_FOUND` and `NOT_INVOLVED` must remain visually and semantically distinct everywhere — chip text, filter options, packet copy. The amber callout box in Attribution explains why.
4. Decisions' `status` is independent of PnL. PnL is a column on `postmortems`, not `decisions`. The UI must not display PnL on a decision row except as a derived/joined value from the linked post-mortem.
5. The `LOCAL · APPEND-ONLY` status-bar mode badge and the `trades_raw LOCKED` indicator are load-bearing trust signals — don't remove them.

## Out of scope for v1

- Authentication (this is a local-first single-operator tool)
- Real-time updates / WebSocket sync
- Mobile / responsive layouts (the app assumes ≥ 1440px desktop)
- Theming beyond the 3-color accent tweak (magenta / amber / cyan) — keep the dark canvas
