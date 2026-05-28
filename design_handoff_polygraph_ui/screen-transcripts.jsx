/* ============================================
   Polygraph — Import Transcripts  (tabs[1])
   Mirrors ledger.transcript_import.import_transcript_text:
     - Plain (Human/Assistant, You/ChatGPT, User/Claude) or ChatGPT JSON
     - Match assistant turns to trades by slug (exact/hyphen-normalized) + title keywords
     - Create NEEDS_REVIEW attributions with evidence excerpt + match_quality (0.4-0.9)
     - Dedupe on (evidence_source, trade_id)
   ============================================ */
const { useState: useStateT, useMemo: useMemoT } = React;

function ImportTranscripts({ go }) {
  const M = window.MOCK;
  const H = window.MOCK_HELPERS;

  const [stage, setStage] = useStateT("DROP"); // DROP · PREVIEW · DONE
  const [assistant, setAssistant] = useStateT("GPT");
  const [fmt, setFmt] = useStateT("plain");
  const [filename, setFilename] = useStateT("chatgpt_export_2026-05-22.json");
  const [selectedTurnIdx, setSelectedTurnIdx] = useStateT(0);

  // Mock parsed turns for the preview
  const turns = [
    { idx: 0, role: "Human",     text: 'Looking at btc-above-100k-eoy-2026. Currently 0.58. Worth a yes at this price?' },
    { idx: 1, role: "Assistant", text: 'BTC over $100k is a high-conviction yes at anything below 0.62 for me.\n\nMy implied is closer to 0.71 given ETF flows and the supply schedule. Buying yes at 0.58 is a clean 13pt edge.\n\nSize: I would not push past 8% NAV given idiosyncratic spot risk, but I think the trade is sound.' },
    { idx: 2, role: "Human",     text: 'OK, putting some on. What about Hormuz?' },
    { idx: 3, role: "Assistant", text: 'For hormuz-normal-end-june-2026 — Portwatch is decisive. Yes — buy NO at 0.36-0.38. Cap exposure at 30% NAV.' },
    { idx: 4, role: "Human",     text: 'And the September Fed cut?' },
    { idx: 5, role: "Assistant", text: 'Labor cooling argument holds. Buying at 0.41 is defensible — I think implied should be 0.55+.' },
    { idx: 6, role: "Human",     text: 'Thanks. Last one — Chevron deference, you mentioned it last week?' },
    { idx: 7, role: "Assistant", text: 'Chevron came up in a separate macro thread; I did not actually make a call on the specific market. Worth pulling the oral argument before sizing.' },
  ];

  // Mock matches (subset of assistant turns matched to trades/markets)
  const matches = [
    { turn_idx: 1, kind: "TRADE",    target_id: "trd_9f44", market_slug: "btc-above-100k-eoy-2026",       match_quality: 0.72, attribution: "DIRECT_RECOMMENDATION", method: "slug_exact" },
    { turn_idx: 1, kind: "TRADE",    target_id: "trd_9f45", market_slug: "btc-above-100k-eoy-2026",       match_quality: 0.68, attribution: "DIRECT_RECOMMENDATION", method: "slug_exact" },
    { turn_idx: 3, kind: "DECISION", target_id: "dec_8f3e29a01b1c01a8", market_slug: "hormuz-normal-end-june-2026", match_quality: 0.91, attribution: "DIRECT_RECOMMENDATION", method: "slug_exact" },
    { turn_idx: 5, kind: "DECISION", target_id: "dec_b022f8e6411dd0c1", market_slug: "fed-cuts-rates-september-2026", match_quality: 0.83, attribution: "SUPPORTED_AFTER_REVIEW", method: "title_keyword" },
    { turn_idx: 7, kind: "DECISION", target_id: "dec_d8eee03f4b6f99aa", market_slug: "scotus-strikes-chevron-term", match_quality: 0.55, attribution: "MENTIONED_BUT_NOT_RECOMMENDED", method: "title_keyword" },
  ];

  const result = {
    turns_parsed: turns.length,
    assistant_turns: turns.filter(t => t.role === "Assistant").length,
    matches_found: matches.length,
    attributions_created: matches.length,
    duplicates_skipped: 0,
    errors: [],
  };

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[1] · import transcripts · `transcript_import.import_transcript_text()`</div>
          <div className="h-stat lg mt-1">IMPORT TRANSCRIPTS</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            chat exports → NEEDS_REVIEW attributions · plain (Human/Assistant, You/ChatGPT, User/Claude) or ChatGPT JSON · match by slug + title keywords
          </div>
        </div>
      </div>

      <div className="screen-body" style={{ padding: 24, overflowY: "auto" }}>
        <div className="row gap-3 mb-4" style={{ fontSize: 11 }}>
          {[
            ["DROP",    "1 · pick transcript + assistant"],
            ["PREVIEW", "2 · review parsed turns & matches"],
            ["DONE",    "3 · commit attributions"],
          ].map(([k, l]) => (
            <div key={k} className={"step " + (stage === k ? "active" : "")}>{l}</div>
          ))}
        </div>

        {stage === "DROP" && (
          <div className="col gap-4">
            <div className="dropzone" onClick={() => setStage("PREVIEW")}>
              <div className="h-stat" style={{ color: "var(--text-1)" }}>⌄ drop transcript file</div>
              <div className="dim mt-2 mono" style={{ fontSize: 12 }}>accepted: .txt · .md · .json</div>
              <div className="div-dashed" style={{ width: "60%", margin: "20px auto" }} />
              <div className="dim" style={{ fontSize: 11, maxWidth: 540, margin: "0 auto" }}>
                plain-text labels recognized: <span className="mono">Human:</span> / <span className="mono">Assistant:</span> · <span className="mono">You:</span> / <span className="mono">ChatGPT:</span> · <span className="mono">User:</span> / <span className="mono">Claude:</span><br/>
                or paste the ChatGPT JSON export (<span className="mono">conversations.json</span>).
              </div>
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="col"><label className="in-label">assistant · ASSISTANTS enum</label>
                <select className="in" value={assistant} onChange={e => setAssistant(e.target.value)}>
                  {M.ASSISTANTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <div className="dim mono mt-1" style={{ fontSize: 10 }}>which assistant produced this transcript</div>
              </div>
              <div className="col"><label className="in-label">fmt · auto-detected</label>
                <select className="in" value={fmt} onChange={e => setFmt(e.target.value)}>
                  <option value="plain">plain</option>
                  <option value="chatgpt_json">chatgpt_json</option>
                </select>
                <div className="dim mono mt-1" style={{ fontSize: 10 }}>.json → chatgpt_json · else plain</div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-hd">
                <span className="h-comment">recent transcript imports</span>
              </div>
              <table className="tbl">
                <thead><tr><th>imported_at</th><th>source_file</th><th>fmt</th><th>assistant</th><th className="num">turns</th><th className="num">assistant turns</th><th className="num">matches</th><th className="num">+attributions</th></tr></thead>
                <tbody>
                  {M.TRANSCRIPT_RUNS.map(r => (
                    <tr key={r.run_id}>
                      <td className="id mono">{r.imported_at}</td>
                      <td className="mono dim">{r.source_file}</td>
                      <td className="mono dim">{r.fmt}</td>
                      <td><Chip kind={r.assistant === "GPT" ? "gpt" : r.assistant === "CLAUDE" ? "claude" : "draft"}>{r.assistant}</Chip></td>
                      <td className="num mono">{r.turns_parsed}</td>
                      <td className="num mono">{r.assistant_turns}</td>
                      <td className="num mono">{r.matches_found}</td>
                      <td className="num pos">+{r.attributions_created}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stage === "PREVIEW" && (
          <div className="col gap-4">
            {/* Run summary */}
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="raw-block p-3">
                <div className="h-caps">source</div>
                <div className="mono mt-1" style={{ fontSize: 12 }}>{filename}</div>
                <div className="dim mono mt-1" style={{ fontSize: 10 }}>fmt={fmt} · ~{(turns.reduce((s, t) => s + t.text.length, 0)).toLocaleString()} chars</div>
              </div>
              <div className="raw-block p-3">
                <div className="h-caps">assistant</div>
                <div className="row gap-2 mt-1">
                  <Chip kind={assistant === "GPT" ? "gpt" : assistant === "CLAUDE" ? "claude" : "draft"}>{assistant}</Chip>
                  <span className="dim mono" style={{ fontSize: 10 }}>· every created attribution carries this assistant</span>
                </div>
              </div>
            </div>

            <div className="grid-3">
              <div className="panel p-3"><div className="h-caps">turns_parsed</div><div className="h-stat dim mt-1">{result.turns_parsed}</div></div>
              <div className="panel p-3"><div className="h-caps">assistant_turns</div><div className="h-stat mt-1">{result.assistant_turns}</div></div>
              <div className="panel p-3"><div className="h-caps">matches_found</div><div className="h-stat pos mt-1">{result.matches_found}</div></div>
            </div>

            {/* Two-column: turns on left, matches on right */}
            <div className="grid-2" style={{ gap: 16 }}>
              <div className="panel" style={{ display: "flex", flexDirection: "column", maxHeight: 560 }}>
                <div className="panel-hd">
                  <span className="h-comment">parsed turns · {turns.length}</span>
                  <span className="dim mono" style={{ fontSize: 10 }}>click to inspect</span>
                </div>
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {turns.map(t => {
                    const isMatch = matches.some(m => m.turn_idx === t.idx);
                    return (
                      <div
                        key={t.idx}
                        className={"turn-row " + (selectedTurnIdx === t.idx ? "active" : "")}
                        onClick={() => setSelectedTurnIdx(t.idx)}
                      >
                        <div className="row" style={{ justifyContent: "space-between" }}>
                          <span className={"mono " + (t.role === "Assistant" ? "brand" : "dim")} style={{ fontSize: 10 }}>
                            {t.role.toUpperCase()} · turn[{t.idx}]
                          </span>
                          {isMatch && <Chip kind="needs-rev">MATCH</Chip>}
                        </div>
                        <div className="mono mt-1" style={{ fontSize: 11, color: "var(--text-1)", whiteSpace: "pre-wrap" }}>
                          {t.text.length > 200 ? t.text.slice(0, 200) + "…" : t.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="panel" style={{ display: "flex", flexDirection: "column", maxHeight: 560 }}>
                <div className="panel-hd">
                  <span className="h-comment">matches → NEEDS_REVIEW attributions · {matches.length}</span>
                </div>
                <div style={{ overflowY: "auto", flex: 1, padding: 12 }} className="col gap-2">
                  {matches.map((m, i) => (
                    <div key={i} className={"editable-block p-3 " + (selectedTurnIdx === m.turn_idx ? "highlight" : "")}>
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <span className="mono brand">turn[{m.turn_idx}]</span>
                        <Chip kind="needs-rev">NEEDS_REVIEW</Chip>
                      </div>
                      <div className="row mt-2 gap-2" style={{ fontSize: 11, flexWrap: "wrap" }}>
                        <span className="evidence-tag">{m.kind}</span>
                        <span className="mono">{m.target_id}</span>
                      </div>
                      <div className="dim mono mt-1" style={{ fontSize: 10 }}>{m.market_slug}</div>
                      <div className="row mt-2" style={{ justifyContent: "space-between", fontSize: 11 }}>
                        <span className="mono">{m.attribution}</span>
                        <span className="mono brand tnum">match_q {m.match_quality.toFixed(2)}</span>
                      </div>
                      <div className="dim mt-1" style={{ fontSize: 10 }}>method: <span className="mono">{m.method}</span></div>
                    </div>
                  ))}
                  <div className="dim mt-2" style={{ fontSize: 10 }}>
                    <span className="warn">⚠</span> match_quality lands between <span className="mono">0.40–0.90</span>; all rows go in as <span className="mono">NEEDS_REVIEW</span> and dedupe by <span className="mono">(evidence_source, trade_id)</span>.
                  </div>
                </div>
              </div>
            </div>

            <div className="panel p-3" style={{ borderLeft: "3px solid var(--amber)" }}>
              <div className="row gap-2">
                <span className="warn">⚠</span>
                <span className="warn mono" style={{ fontSize: 11 }}>nothing is auto-confirmed</span>
              </div>
              <div className="dim mt-2" style={{ fontSize: 11 }}>
                These rows will appear in the Attribution screen filtered to <span className="mono">NEEDS_REVIEW</span>. You confirm/reject each one. Raw trades are not touched.
              </div>
            </div>

            <div className="row gap-2">
              <Btn kind="primary" onClick={() => setStage("DONE")}>▶ COMMIT {result.attributions_created} ATTRIBUTIONS</Btn>
              <Btn kind="ghost" onClick={() => setStage("DROP")}>CANCEL</Btn>
            </div>
          </div>
        )}

        {stage === "DONE" && (
          <div className="panel p-4">
            <div className="h-comment mb-2">✓ transcript imported · TranscriptImportResult</div>
            <div className="h-stat pos">+{result.attributions_created} NEEDS_REVIEW attributions</div>
            <pre className="mono mt-3" style={{ fontSize: 11, background: "var(--bg-1)", border: "1px solid var(--border-1)", padding: 12, color: "var(--text-1)" }}>
{`{
  "turns_parsed": ${result.turns_parsed},
  "assistant_turns": ${result.assistant_turns},
  "matches_found": ${result.matches_found},
  "attributions_created": ${result.attributions_created},
  "duplicates_skipped": ${result.duplicates_skipped},
  "errors": []
}`}
            </pre>
            <div className="div-dashed" />
            <div className="row gap-2">
              <Btn kind="primary" onClick={() => go("attribution")}>▶ REVIEW IN ATTRIBUTION QUEUE</Btn>
              <Btn kind="ghost" onClick={() => setStage("DROP")}>IMPORT ANOTHER</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

window.ImportTranscripts = ImportTranscripts;
