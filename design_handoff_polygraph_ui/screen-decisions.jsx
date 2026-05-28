/* ============================================
   Polygraph — Decisions + Assistant Attribution
   Decisions mirrors create_decision/edit_decision in ledger.services.
   Attribution mirrors assistant_attributions table + add_assistant_attribution.
   ============================================ */
const { useState: useStateD2, useMemo: useMemoD2 } = React;

/* ============================================
   Decisions  (tabs[4])
   ============================================ */
function Decisions({ go }) {
  const M = window.MOCK;
  const H = window.MOCK_HELPERS;
  const [sel, setSel] = useStateD2(M.DECISIONS[0]);
  const [creating, setCreating] = useStateD2(false);

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[4] · decisions · `fetch_decisions()`</div>
          <div className="h-stat lg mt-1">DECISIONS</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            user-annotated trading ideas · editable · referenced fills remain immutable.
          </div>
        </div>
        <div className="row gap-2">
          <Btn kind="ghost" size="sm">⌄ FILTER</Btn>
          <Btn kind="primary" size="sm" onClick={() => setCreating(true)}>+ NEW DECISION</Btn>
        </div>
      </div>

      <div className="two-col">
        <div className="panel two-col-pane" style={{ width: 460 }}>
          <div className="panel-hd">
            <span className="h-comment">all · {M.DECISIONS.length}</span>
            <span className="dim mono" style={{ fontSize: 10 }}>ordered by decision_timestamp DESC</span>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {M.DECISIONS.map(d => {
              const pm = H.postmortemForDecision(d.decision_id);
              const pnl = pm?.pnl;
              return (
                <div key={d.decision_id} className={"decision-row " + (sel?.decision_id === d.decision_id ? "active" : "")} onClick={() => { setSel(d); setCreating(false); }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="mono brand">{H.shortId(d.decision_id, 14)}</span>
                    <Chip kind={d.status === "OPEN" || d.status === "DRAFT" ? "warn" : d.status === "RESOLVED_WIN" ? "pos" : d.status === "INVALIDATED" ? "draft" : "neg"}>{d.status}</Chip>
                  </div>
                  <div className="row mt-1 gap-2" style={{ fontSize: 11, flexWrap: "wrap" }}>
                    <Chip>{d.project}</Chip>
                    <span className="mono dim" style={{ fontSize: 10 }}>· {d.sleeve}</span>
                    <span className="mono">{d.side} {d.outcome} @ {H.fmtPrice(d.price_used)}</span>
                  </div>
                  <div className="mono mt-1" style={{ fontSize: 11, color: "var(--text-1)" }}>{d.market_title.slice(0, 80)}{d.market_title.length > 80 ? "…" : ""}</div>
                  <div className="row mt-2" style={{ justifyContent: "space-between", fontSize: 10 }}>
                    <span className="dim">{H.decisionLinkedTrades(d.decision_id).length} fills · {H.attributionsForDecision(d.decision_id).length} attr</span>
                    {pnl != null && <span className={pnl < 0 ? "neg" : "pos"} style={{ fontFamily: "var(--font-mono)" }}>{H.fmtMoney(pnl)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel two-col-pane">
          {creating
            ? <CreateDecisionForm onCancel={() => setCreating(false)} />
            : sel ? <DecisionDetail d={sel} go={go} />
                  : <Empty title="select a decision" hint="or create a new one" />}
        </div>
      </div>
    </div>
  );
}

function DecisionDetail({ d, go }) {
  const H = window.MOCK_HELPERS;
  const fills = H.decisionLinkedTrades(d.decision_id);
  const attrs = H.attributionsForDecision(d.decision_id);
  const pm = H.postmortemForDecision(d.decision_id);
  return (
    <div style={{ overflowY: "auto", flex: 1, padding: 20 }} className="col gap-4">
      {/* Header */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="col">
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            <span className="mono brand">{d.decision_id}</span>
            <Chip>{d.project}</Chip>
            <span className="mono dim" style={{ fontSize: 10 }}>sleeve: {d.sleeve}</span>
            <Chip kind={d.status === "OPEN" || d.status === "DRAFT" ? "warn" : d.status === "RESOLVED_WIN" ? "pos" : d.status === "INVALIDATED" ? "draft" : "neg"}>{d.status}</Chip>
          </div>
          <div className="h-stat mt-2">
            <span className={d.side === "BUY" ? "pos" : "neg"}>{d.side}</span>{" "}
            <span style={{ color: "var(--text-1)" }}>{d.outcome}</span>
            <span className="dim" style={{ fontSize: 18, marginLeft: 8 }}>@</span>
            <span className="mono" style={{ fontSize: 24, marginLeft: 6 }}>{H.fmtPrice(d.price_used)}</span>
          </div>
          <div className="mono mt-2" style={{ fontSize: 12 }}>{d.market_title}</div>
          <div className="dim mono mt-1" style={{ fontSize: 10 }}>{d.market_slug}</div>
        </div>
        <div className="col" style={{ alignItems: "flex-end" }}>
          {pm
            ? (<>
                <div className="h-caps">post-mortem p&l</div>
                <div className={"h-stat " + (pm.pnl < 0 ? "neg" : "pos")}>{H.fmtMoney(pm.pnl)}</div>
              </>)
            : (<>
                <div className="h-caps">status</div>
                <div className="dim mono">no post-mortem yet</div>
              </>)
          }
          <div className="row gap-2 mt-3">
            <Btn size="sm">EDIT</Btn>
            <Btn kind="secondary" size="sm" onClick={() => go("postmortems")}>{pm ? "VIEW PM" : "+ POST-MORTEM"}</Btn>
            <Btn kind="ghost" size="sm" onClick={() => go("packets")}>EXPORT PACKET</Btn>
          </div>
        </div>
      </div>

      <div className="div-dashed" />

      {/* All editable decision fields (mirrors DECISION_FIELDS in services.py) */}
      <div className="grid-2">
        <ReadField k="intent" v={d.intent} />
        <ReadField k="decision_type" v={d.decision_type} />
        <ReadField k="target_entry" v={d.target_entry} />
        <ReadField k="target_exit" v={d.target_exit} />
        <ReadField k="max_allocation" v={d.max_allocation != null ? `${(d.max_allocation * 100).toFixed(0)}% NAV` : "—"} />
        <ReadField k="decision_timestamp" v={d.decision_timestamp} mono />
      </div>

      <div className="grid-2">
        <div className="editable-block p-3">
          <div className="h-comment mb-2">thesis_summary</div>
          <div className="sans" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-0)" }}>{d.thesis_summary}</div>
        </div>
        <div className="editable-block p-3">
          <div className="h-comment mb-2">rule_summary</div>
          <div className="sans" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-0)" }}>{d.rule_summary}</div>
        </div>
        <div className="editable-block p-3">
          <div className="h-comment mb-2">catalyst</div>
          <div className="sans" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-0)" }}>{d.catalyst}</div>
        </div>
        <div className="editable-block p-3">
          <div className="h-comment mb-2" style={{ color: "var(--amber)" }}>invalidation</div>
          <div className="sans" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-0)" }}>{d.invalidation}</div>
        </div>
      </div>

      {d.user_notes && (
        <div className="editable-block p-3">
          <div className="h-comment mb-2">user_notes</div>
          <div className="sans" style={{ fontSize: 13, lineHeight: 1.6 }}>{d.user_notes}</div>
        </div>
      )}

      {/* Attribution summary — pulls from real attributions */}
      <SectionH right={<CmdBtn onClick={() => go("attribution")}>review</CmdBtn>}>assistant_attributions · WHERE decision_id = ? · {attrs.length}</SectionH>
      <div className="raw-block">
        <table className="tbl" style={{ background: "transparent" }}>
          <thead><tr><th>assistant</th><th>attribution</th><th className="num">match_q</th><th>review_status</th><th>evidence_source</th></tr></thead>
          <tbody>
            {attrs.map(a => (
              <tr key={a.attribution_id}>
                <td><span className="mono brand">{a.assistant}</span></td>
                <td><span className="mono">{a.attribution}</span></td>
                <td className="num mono">{(a.match_quality * 100).toFixed(0)}%</td>
                <td><ReviewStatus status={a.review_status} /></td>
                <td className="mono dim" style={{ fontSize: 10, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>{a.evidence_source || "—"}</td>
              </tr>
            ))}
            {attrs.length === 0 && <tr><td colSpan="5" className="dim" style={{ padding: 12 }}>no attributions yet — export a review packet to seed them.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Linked fills */}
      <SectionH right={<CmdBtn onClick={() => go("ledger")}>open ledger</CmdBtn>}>linked fills · trade_decision_links · {fills.length}</SectionH>
      <div className="raw-block">
        <table className="tbl" style={{ background: "transparent" }}>
          <thead><tr><th>trade_id</th><th>ts</th><th>side</th><th>out</th><th className="num">px</th><th className="num">shares</th><th className="num">notional</th><th className="num">link_conf</th></tr></thead>
          <tbody>
            {fills.map(t => {
              const link = window.MOCK.LINKS.find(l => l.trade_id === t.trade_id && l.decision_id === d.decision_id);
              return (
                <tr key={t.trade_id}>
                  <td><IdMono id={t.trade_id} /></td>
                  <td className="id mono">{t.timestamp.replace("T", " ").replace("Z", "")}</td>
                  <td><span className={t.side === "BUY" ? "pos" : "neg"}>{t.side}</span></td>
                  <td>{t.outcome}</td>
                  <td className="num mono">{H.fmtPrice(t.price)}</td>
                  <td className="num mono dim">{t.shares.toFixed(3)}</td>
                  <td className="num mono">{H.fmtMoney(t.notional)}</td>
                  <td className="num mono dim">{(link.link_confidence * 100).toFixed(0)}%</td>
                </tr>
              );
            })}
            {fills.length === 0 && <tr><td colSpan="8" className="dim" style={{ padding: 12 }}>no linked fills — visit the Unlinked Trades queue.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReadField({ k, v, mono }) {
  return (
    <div className="raw-block p-3" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="h-caps">{k}</span>
      <span className={mono ? "mono" : ""} style={{ fontSize: 13, color: "var(--text-0)" }}>{v || "—"}</span>
    </div>
  );
}

function CreateDecisionForm({ onCancel }) {
  const M = window.MOCK;
  const [project, setProject] = useStateD2("EXPERIMENTAL");
  const [sleeve, setSleeve] = useStateD2("main");
  return (
    <div style={{ overflowY: "auto", flex: 1, padding: 20 }} className="col gap-3">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="h-stat sm">+ NEW DECISION</div>
        <Btn kind="ghost" size="sm" onClick={onCancel}>✕ CANCEL</Btn>
      </div>
      <div className="dim mono" style={{ fontSize: 11 }}>maps to `create_decision(conn, **fields)`</div>

      <div className="grid-2" style={{ gap: 12 }}>
        <div className="col"><label className="in-label">project · enum</label>
          <select className="in" value={project} onChange={e => setProject(e.target.value)}>
            {M.PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="col"><label className="in-label">sleeve</label>
          <select className="in" value={sleeve} onChange={e => setSleeve(e.target.value)}>
            {M.SLEEVES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col"><label className="in-label">market_slug</label><input className="in" placeholder="e.g. fed-cuts-rates-december-2026" /></div>
        <div className="col"><label className="in-label">market_title</label><input className="in" placeholder="human-readable title" /></div>
        <div className="col"><label className="in-label">outcome</label>
          <select className="in"><option>Yes</option><option>No</option></select>
        </div>
        <div className="col"><label className="in-label">side</label>
          <select className="in"><option>BUY</option><option>SELL</option></select>
        </div>
        <div className="col"><label className="in-label">intent</label>
          <select className="in"><option>OPEN_POSITION</option><option>ADD</option><option>REDUCE</option><option>CLOSE</option><option>MARKET_MAKE</option></select>
        </div>
        <div className="col"><label className="in-label">decision_type</label>
          <select className="in"><option>RULE_FOLLOW</option><option>MODEL_EDGE</option><option>SPREAD_CAPTURE</option><option>READ_ON_PROCEDURE</option><option>EXPERIMENTAL</option></select>
        </div>
        <div className="col"><label className="in-label">price_used · 0–1</label><input className="in" type="number" min="0" max="1" step="0.001" defaultValue="0.50" /></div>
        <div className="col"><label className="in-label">max_allocation · 0–1</label><input className="in" type="number" min="0" max="1" step="0.01" defaultValue="0.05" /></div>
        <div className="col"><label className="in-label">target_entry</label><input className="in" placeholder="0.36–0.40" /></div>
        <div className="col"><label className="in-label">target_exit</label><input className="in" placeholder="0.65 or resolution" /></div>
      </div>

      <div className="col"><label className="in-label">thesis_summary</label><textarea className="in" rows="3" placeholder="why is this trade right? what's the edge?" /></div>
      <div className="col"><label className="in-label">rule_summary</label><textarea className="in" rows="2" placeholder="which playbook rule does this fall under?" /></div>
      <div className="col"><label className="in-label">catalyst</label><input className="in" placeholder="next scheduled event that should move this" /></div>
      <div className="col"><label className="in-label">invalidation</label><input className="in" placeholder="what would force you out?" /></div>
      <div className="col"><label className="in-label">user_notes</label><textarea className="in" rows="2" /></div>

      <div className="row gap-2 mt-2">
        <Btn kind="primary">▶ CREATE</Btn>
        <Btn kind="ghost" onClick={onCancel}>CANCEL</Btn>
        <span className="dim mono" style={{ fontSize: 10, alignSelf: "center" }}>status defaults to DRAFT</span>
      </div>
    </div>
  );
}

/* ============================================
   Assistant Attribution  (tabs[5])
   Models the `assistant_attributions` table directly.
   ============================================ */
function Attribution({ go }) {
  const M = window.MOCK;
  const H = window.MOCK_HELPERS;

  const [filterAssistant, setFilterAssistant] = useStateD2("ALL");
  const [filterStatus, setFilterStatus] = useStateD2("ALL");
  const [filterAttr, setFilterAttr] = useStateD2("ALL");
  const [pivot, setPivot] = useStateD2("ALL"); // ALL · TRADE · DECISION
  const [sel, setSel] = useStateD2(M.ATTRIBUTIONS_ROWS[0]);

  const rows = useMemoD2(() => {
    return M.ATTRIBUTIONS_ROWS.filter(a => {
      if (filterAssistant !== "ALL" && a.assistant !== filterAssistant) return false;
      if (filterStatus !== "ALL" && a.review_status !== filterStatus) return false;
      if (filterAttr !== "ALL" && a.attribution !== filterAttr) return false;
      if (pivot === "TRADE" && !a.trade_id) return false;
      if (pivot === "DECISION" && !a.decision_id) return false;
      return true;
    });
  }, [filterAssistant, filterStatus, filterAttr, pivot]);

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[5] · assistant attribution · `add_assistant_attribution`</div>
          <div className="h-stat lg mt-1">ASSISTANT ATTRIBUTION</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            one row per (subject · assistant) — {M.ASSISTANTS.join(" · ")}. subject = trade_id OR decision_id (at least one). Annotation only — never mutates fills.
          </div>
        </div>
      </div>

      <div className="three-col">
        {/* LEFT: filters + queue */}
        <div className="panel three-col-pane" style={{ width: 380, minWidth: 380, maxWidth: 380 }}>
          <div className="panel-hd">
            <span className="h-comment">attributions · {rows.length}</span>
            <CmdBtn>+ new</CmdBtn>
          </div>

          <div style={{ padding: 12, borderBottom: "1px solid var(--border-1)" }} className="col gap-2">
            <div className="row gap-2">
              {["ALL", "TRADE", "DECISION"].map(p => (
                <button key={p} className={"target-pick " + (pivot === p ? "active" : "")} style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => setPivot(p)}>{p}</button>
              ))}
            </div>
            <select className="in" value={filterAssistant} onChange={e => setFilterAssistant(e.target.value)}>
              <option value="ALL">all assistants</option>
              {M.ASSISTANTS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className="in" value={filterAttr} onChange={e => setFilterAttr(e.target.value)}>
              <option value="ALL">any attribution value</option>
              {M.ATTRIBUTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className="in" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="ALL">any review status</option>
              {M.REVIEW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {rows.map(a => (
              <div key={a.attribution_id} className={"q-row " + (sel?.attribution_id === a.attribution_id ? "active" : "")} onClick={() => setSel(a)}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="mono brand" style={{ fontSize: 10 }}>{H.shortId(a.attribution_id, 9)}</span>
                  <ReviewStatus status={a.review_status} />
                </div>
                <div className="row gap-2 mt-1" style={{ fontSize: 11 }}>
                  <Chip kind={a.assistant === "GPT" ? "gpt" : a.assistant === "CLAUDE" ? "claude" : "draft"}>{a.assistant}</Chip>
                  <span className="mono">{a.attribution}</span>
                </div>
                <div className="mt-1 mono dim" style={{ fontSize: 10 }}>
                  {a.trade_id    && <>trd: {H.shortId(a.trade_id, 7)}</>}
                  {a.decision_id && <>dec: {H.shortId(a.decision_id, 10)}</>}
                </div>
                <div className="row mt-1" style={{ justifyContent: "space-between", fontSize: 10 }}>
                  <span className="dim mono">match_q</span>
                  <span className="mono brand">{(a.match_quality * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
            {rows.length === 0 && <Empty title="no attributions match" hint="loosen filters or import a transcript"/>}
          </div>
        </div>

        {/* CENTER: editor */}
        <div className="three-col-pane col" style={{ overflowY: "auto", gap: 16, padding: 16 }}>
          {sel
            ? <AttributionEditor a={sel} go={go} />
            : <Empty title="select an attribution" />}
        </div>

        {/* RIGHT: legend + workflow */}
        <div className="three-col-pane col" style={{ gap: 16, overflowY: "auto", padding: 16, maxWidth: 360 }}>
          <div className="panel p-3">
            <div className="h-comment mb-3">attribution vocabulary · enums.ATTRIBUTIONS</div>
            <div className="col gap-3">
              {[
                ["DIRECT_RECOMMENDATION", "Assistant explicitly told you to make this trade."],
                ["SUPPORTED_AFTER_REVIEW", "You proposed; assistant reviewed and supported."],
                ["OPPOSED", "Assistant argued against this trade."],
                ["MENTIONED_BUT_NOT_RECOMMENDED", "Came up in conversation; no actual recommendation."],
                ["NO_MATCH_FOUND", "Conversations searched — no matching recommendation exists."],
                ["NOT_INVOLVED", "Assistant was not part of this decision flow at all."],
                ["UNCLEAR", "Conversation is ambiguous; needs another pass."],
              ].map(([k, desc]) => (
                <div key={k} className="col gap-1">
                  <span className="mono" style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--text-0)" }}>{k}</span>
                  <div className="dim" style={{ fontSize: 11, lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-3" style={{ borderColor: "var(--amber)" }}>
            <div className="h-comment mb-2" style={{ color: "var(--amber)" }}>critical distinction</div>
            <div className="col gap-3" style={{ fontSize: 12, lineHeight: 1.6 }}>
              <div><Chip kind="draft">NO_MATCH_FOUND</Chip><div className="dim mt-1">= you opened the assistant's history, searched, and found nothing relevant.</div></div>
              <div><Chip kind="draft">NOT_INVOLVED</Chip><div className="dim mt-1">= assistant was never part of this trade's reasoning loop.</div></div>
              <div className="dim" style={{ fontSize: 11, borderTop: "1px dashed var(--border-1)", paddingTop: 8 }}>
                downstream analytics count these very differently.
              </div>
            </div>
          </div>

          <div className="panel p-3">
            <div className="h-comment mb-2">review_status workflow</div>
            <div className="col gap-2">
              <div className="row gap-2"><Chip kind="draft">DRAFT</Chip><span className="dim">manual, not committed</span></div>
              <div className="row gap-2"><Chip kind="proposed">MODEL_PROPOSED</Chip><span className="dim">model classified · awaiting you</span></div>
              <div className="row gap-2"><Chip kind="needs-rev">NEEDS_REVIEW</Chip><span className="dim">transcript-sourced (match_q 0.4–0.9)</span></div>
              <div className="row gap-2"><Chip kind="confirmed">USER_CONFIRMED</Chip><span className="dim">you signed off</span></div>
              <div className="row gap-2"><Chip kind="rejected">REJECTED</Chip><span className="dim">disagreed with proposal</span></div>
            </div>
            <div className="dim mt-3" style={{ fontSize: 10 }}>
              `mark_attribution_review_status(conn, attribution_id, review_status)`
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttributionEditor({ a, go }) {
  const M = window.MOCK;
  const H = window.MOCK_HELPERS;
  const [attr, setAttr] = useStateD2(a.attribution);
  const [matchQ, setMatchQ] = useStateD2(Math.round(a.match_quality * 100));
  const [status, setStatus] = useStateD2(a.review_status);
  const [evidence, setEvidence] = useStateD2(a.evidence);

  useEffectA(() => {
    setAttr(a.attribution);
    setMatchQ(Math.round(a.match_quality * 100));
    setStatus(a.review_status);
    setEvidence(a.evidence);
  }, [a.attribution_id]);

  const subject = a.decision_id ? H.decisionById(a.decision_id) : null;
  const trade   = a.trade_id    ? window.MOCK.TRADES.find(t => t.trade_id === a.trade_id) : null;

  return (
    <div className="col gap-4">
      {/* Subject context */}
      <div className="panel p-3">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="h-comment">subject</span>
          <Chip kind={a.assistant === "GPT" ? "gpt" : a.assistant === "CLAUDE" ? "claude" : "draft"}>{a.assistant}</Chip>
        </div>
        {subject && (
          <div className="mt-2 col gap-1">
            <div className="row gap-2">
              <span className="mono brand">{subject.decision_id}</span>
              <Chip>{subject.project}</Chip>
              <span className="mono dim" style={{ fontSize: 10 }}>sleeve: {subject.sleeve}</span>
            </div>
            <div className="mono mt-1" style={{ fontSize: 13 }}>
              <span className={subject.side === "BUY" ? "pos" : "neg"}>{subject.side}</span>{" "}
              {subject.outcome} @ {H.fmtPrice(subject.price_used)}
            </div>
            <div className="mono mt-1" style={{ fontSize: 11 }}>{subject.market_title}</div>
            <div className="dim mt-2 sans" style={{ fontSize: 12, lineHeight: 1.6 }}>{subject.thesis_summary}</div>
            <Btn kind="ghost" size="sm" style={{ alignSelf: "flex-start", marginTop: 8 }} onClick={() => go("decisions")}>→ open decision</Btn>
          </div>
        )}
        {trade && (
          <div className="mt-2 col gap-1">
            <div className="row gap-2">
              <span className="mono brand">{trade.trade_id}</span>
              <Chip kind={trade.outcome === "Yes" ? "yes" : "no"}>{trade.outcome}</Chip>
              <span className={trade.side === "BUY" ? "pos" : "neg"}>{trade.side}</span>
              <span className="mono dim" style={{ fontSize: 10 }}>· {trade.action}</span>
            </div>
            <div className="mono mt-1" style={{ fontSize: 11 }}>{trade.market_title}</div>
            <div className="dim mt-1 mono" style={{ fontSize: 10 }}>{H.fmtPrice(trade.price)} · {trade.shares.toFixed(3)} shares · {H.fmtMoney(trade.notional)}</div>
            <Btn kind="ghost" size="sm" style={{ alignSelf: "flex-start", marginTop: 8 }} onClick={() => go("ledger")}>→ open trade</Btn>
          </div>
        )}
      </div>

      {/* Attribution value */}
      <div className="panel" style={{ borderLeft: `3px solid ${a.assistant === "GPT" ? "var(--gpt)" : a.assistant === "CLAUDE" ? "var(--claude)" : "var(--magenta)"}` }}>
        <div className="panel-hd">
          <div className="row gap-2">
            <span className="h-caps" style={{ color: a.assistant === "GPT" ? "var(--gpt)" : a.assistant === "CLAUDE" ? "var(--claude)" : "var(--magenta)" }}>{a.assistant} attribution</span>
            <span className="mono dim" style={{ fontSize: 10 }}>{H.shortId(a.attribution_id, 12)}</span>
          </div>
          <ReviewStatus status={status} />
        </div>
        <div style={{ padding: 14 }} className="col gap-3">
          <div className="attr-grid">
            {M.ATTRIBUTIONS.map(v => (
              <button key={v} className={"attr-pick " + (attr === v ? "active" : "")} onClick={() => setAttr(v)}>
                {v}
              </button>
            ))}
          </div>

          {/* Review status row */}
          <div className="col">
            <label className="in-label">review_status</label>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {M.REVIEW_STATUSES.map(s => (
                <button key={s} className={"status-pick " + (status === s ? "active" : "")} onClick={() => setStatus(s)}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Evidence + meta */}
      <div className="panel p-3 col gap-3">
        <div className="h-comment">evidence + numeric tells</div>

        <div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <label className="in-label">match_quality · 0.00 → 1.00</label>
            <span className="mono tnum brand" style={{ fontSize: 13 }}>{(matchQ / 100).toFixed(2)}</span>
          </div>
          <input type="range" min="0" max="100" value={matchQ} onChange={e => setMatchQ(+e.target.value)} style={{ width: "100%", accentColor: "var(--magenta)" }} />
          <div className="dim mt-1" style={{ fontSize: 10 }}>
            transcript-sourced rows land at 0.4–0.9 with status NEEDS_REVIEW. NO_MATCH_FOUND and NOT_INVOLVED both use match_quality = 1.0.
          </div>
        </div>

        <div className="grid-2" style={{ gap: 12 }}>
          <div className="col">
            <label className="in-label">recommended_price · 0–1</label>
            <input className="in" type="number" min="0" max="1" step="0.01" defaultValue={a.recommended_price ?? ""} placeholder="—" />
          </div>
          <div className="col">
            <label className="in-label">recommended_size · 0–1 (NAV)</label>
            <input className="in" type="number" min="0" step="0.01" defaultValue={a.recommended_size ?? ""} placeholder="—" />
          </div>
        </div>

        <div className="col">
          <label className="in-label">evidence_source · file path, URL, or transcript anchor</label>
          <input className="in" defaultValue={a.evidence_source} placeholder="chat_2026-05-22_oil_hormuz.md#L41-L82" />
        </div>

        <div className="col">
          <label className="in-label">evidence · quote or notes</label>
          <textarea className="in" rows="3" value={evidence} onChange={e => setEvidence(e.target.value)} placeholder='> "..." — verbatim if possible' />
        </div>

        <div className="row gap-2 mt-1">
          <Btn kind="primary">✓ CONFIRM</Btn>
          <Btn kind="danger" size="sm">✕ REJECT</Btn>
          <Btn kind="ghost" size="sm">SAVE DRAFT</Btn>
          <span className="dim mono" style={{ fontSize: 10, marginLeft: "auto", alignSelf: "center" }}>persists via `mark_attribution_review_status`</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Decisions, Attribution });
