/* ============================================
   Polygraph — Attribution Prompt  (tabs[9])
   Mirrors ledger.attribution_prompt.generate_attribution_prompt:
     - Takes a list of trades (caller pre-filters by date range)
     - Groups by UTC date, newest-first
     - Renders a fill-in-the-blank list for the user to paste into Claude/GPT
     - Reply key: CLAUDE | GPT | USER | MIXED · blank for unknown
   Different from Export Packets — packets are PER decision/trade.
   This tab is a bulk attribution sweep.
   ============================================ */
const { useState: useStatePR, useMemo: useMemoPR } = React;

const DATE_RANGES = [
  { days: 30,  label: "Last 30 days" },
  { days: 90,  label: "Last 90 days" },
  { days: 365, label: "Last 365 days" },
  { days: 0,   label: "All time" },
];

function AttributionPrompt({ go }) {
  const M = window.MOCK;
  const H = window.MOCK_HELPERS;
  const [daysBack, setDaysBack] = useStatePR(30);
  const [generated, setGenerated] = useStatePR(false);

  // Pre-filter by date range (caller responsibility, per attribution_prompt.py docstring)
  const cutoff = daysBack === 0 ? 0 : (Date.parse("2026-05-22T22:30:00Z") - daysBack * 86400 * 1000);
  const filtered = useMemoPR(() => {
    return M.TRADES
      .filter(t => daysBack === 0 || Date.parse(t.timestamp) >= cutoff)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }, [daysBack]);

  const promptText = useMemoPR(() => buildAttributionPromptText(filtered), [filtered]);
  const previewLines = promptText.split("\n").slice(0, 100).join("\n");
  const truncated = promptText.split("\n").length > 100;

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[9] · attribution prompt · `attribution_prompt.generate_attribution_prompt()`</div>
          <div className="h-stat lg mt-1">ATTRIBUTION PROMPT</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            bulk trade list, fill-in-the-blank format — paste into Claude or GPT and they label each row{" "}
            <span className="mono">CLAUDE</span> · <span className="mono">GPT</span> · <span className="mono">USER</span> · <span className="mono">MIXED</span> · blank.
          </div>
        </div>
      </div>

      <div className="screen-body" style={{ padding: 24, overflowY: "auto" }}>
        <div className="export-grid">
          {/* LEFT: config + summary */}
          <div className="panel p-4 col gap-4">
            <div className="col">
              <label className="in-label">date range</label>
              <div className="col gap-2">
                {DATE_RANGES.map(r => (
                  <button
                    key={r.days}
                    className={"big-pick " + (daysBack === r.days ? "active" : "")}
                    onClick={() => { setDaysBack(r.days); setGenerated(false); }}
                  >
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="mono brand">{r.label}</span>
                      {daysBack === r.days && <span className="brand">●</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="raw-block p-3">
              <div className="h-caps mb-2">preview range</div>
              <div className="kv">
                <div><span className="k">trades in window</span><span className="v mono">{filtered.length} of {M.TRADES.length}</span></div>
                <div><span className="k">days_back</span><span className="v mono">{daysBack === 0 ? "ALL_TIME" : daysBack}</span></div>
                <div><span className="k">sorted</span><span className="v mono dim">newest-first, grouped by UTC date</span></div>
              </div>
            </div>

            <div className="div-dashed" />

            <div className="col gap-2">
              <Btn kind="primary" disabled={filtered.length === 0} onClick={() => setGenerated(true)}>▶ GENERATE PROMPT</Btn>
              <Btn
                disabled={filtered.length === 0}
                onClick={() => {
                  const blob = new Blob([promptText], { type: "text/plain" });
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement("a");
                  a.href = url; a.download = "attribution_prompt.txt"; a.click();
                  URL.revokeObjectURL(url);
                }}
              >⌄ DOWNLOAD attribution_prompt.txt</Btn>
              <Btn kind="ghost" onClick={() => { navigator.clipboard?.writeText(promptText).catch(() => {}); }}>⌗ COPY ALL</Btn>
            </div>

            <div className="panel p-3" style={{ borderLeft: "3px solid var(--amber)" }}>
              <div className="row gap-2">
                <span className="warn">⚠</span>
                <span className="warn mono" style={{ fontSize: 11 }}>not the same as packets</span>
              </div>
              <div className="dim mt-2" style={{ fontSize: 11 }}>
                Export Packets is per-trade or per-decision and asks for one of 7 ATTRIBUTION enum values + evidence.
                This screen is a bulk sweep — the user pastes the assistant's labelled list back, and the operator types each one in.
              </div>
            </div>
          </div>

          {/* RIGHT: preview pane */}
          <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
            <div className="panel-hd">
              <span className="h-comment">prompt · {filtered.length} trades · preview (first 100 lines)</span>
              <span className="mono dim" style={{ fontSize: 10 }}>
                {promptText.length.toLocaleString()} chars · {promptText.split("\n").length} lines
              </span>
            </div>
            {filtered.length === 0
              ? <div className="dim" style={{ padding: 24, fontSize: 12 }}>no trades in selected range.</div>
              : (
                <div className="markdown-preview" style={{ flex: 1, padding: 16 }}>
                  <pre>{previewLines}{truncated ? "\n..." : ""}</pre>
                </div>
              )
            }
          </div>
        </div>

        {/* Reply key reference */}
        <div className="panel mt-4" style={{ marginTop: 24 }}>
          <div className="panel-hd">
            <span className="h-comment">reply key · how the assistant returns labels</span>
          </div>
          <div className="grid-2" style={{ padding: 16, gap: 16 }}>
            <div className="col gap-2">
              <div className="row gap-2"><Chip kind="gpt">CLAUDE</Chip><span className="dim" style={{ fontSize: 12 }}>this assistant recognised the trade from our chats</span></div>
              <div className="row gap-2"><Chip kind="gpt">GPT</Chip><span className="dim" style={{ fontSize: 12 }}>other assistant influenced this</span></div>
              <div className="row gap-2"><Chip kind="draft">USER</Chip><span className="dim" style={{ fontSize: 12 }}>your own call · no LLM involved</span></div>
              <div className="row gap-2"><Chip kind="warn">MIXED</Chip><span className="dim" style={{ fontSize: 12 }}>both assistants in the loop</span></div>
              <div className="row gap-2"><span className="mono dim" style={{ width: 64, textAlign: "center" }}>(blank)</span><span className="dim" style={{ fontSize: 12 }}>not recognised</span></div>
            </div>
            <div className="dim sans" style={{ fontSize: 12, lineHeight: 1.6 }}>
              Pair this prompt with <span className="mono">prompts/attribution_prompt.md</span> in the repo — that's the system message the operator pastes alongside this trade list. The assistant must answer using only packet context and may not recommend new trades, orders, entries, exits, or live market action.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- text generator ---- */
function buildAttributionPromptText(trades) {
  if (!trades.length) return "No trades to attribute.";
  const lines = [
    "# Polymarket Trade Attribution",
    "",
    "For each trade you recognise from our conversations, reply with:",
    "CLAUDE | GPT | USER (your own call) | MIXED",
    "Leave blank anything you don't recognise.",
    "",
    "---",
    "",
  ];
  // group by UTC date
  const byDay = {};
  trades.forEach(t => {
    const d = t.timestamp.slice(0, 10);
    (byDay[d] = byDay[d] || []).push(t);
  });
  const days = Object.keys(byDay).sort().reverse();
  for (const d of days) {
    const group = byDay[d];
    lines.push(`## ${d}  (${group.length} trade${group.length !== 1 ? "s" : ""})`);
    lines.push("");
    for (const t of group) lines.push(formatTradeLine(t));
    lines.push("");
  }
  return lines.join("\n");
}

function formatTradeLine(t) {
  const time = t.timestamp.slice(11, 16); // HH:MM
  const market = t.market_title || t.market_slug || "Unknown market";
  const outcome = t.outcome || "";
  const action = (t.action || t.side || "").toString().toLowerCase().replace(/^./, ch => ch.toUpperCase());
  const priceStr = t.price != null ? `$${(+t.price).toFixed(3)}` : "";
  const sharesStr = t.shares != null ? `× ${fmtShares(t.shares)}` : "";
  const notionalStr = t.notional != null ? `($${(+t.notional).toFixed(2)})` : "";
  const detail = [outcome, action, priceStr, sharesStr, notionalStr].filter(Boolean).join("  ");
  return `  ${time}  ${market}  |  ${detail}  |  ___________`;
}
function fmtShares(v) {
  const f = +v;
  return f === Math.trunc(f) ? String(Math.trunc(f)) : f.toFixed(2);
}

window.AttributionPrompt = AttributionPrompt;
