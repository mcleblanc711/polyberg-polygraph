/* ============================================
   Polygraph — Post-Mortems, Export Packets, Import Trades
   PM editor mirrors create_or_update_postmortem + POSTMORTEM_FIELDS.
   Export Packets mirrors export_attribution_packet / export_postmortem_packet.
   Import Trades mirrors import_trades_csv + ImportResult.
   ============================================ */
const { useState: useStateP, useMemo: useMemoP } = React;

/* ============================================
   POST-MORTEMS  (tabs[6])
   ============================================ */
function PostMortems({ go }) {
  const M = window.MOCK;
  const H = window.MOCK_HELPERS;
  const [tab, setTab] = useStateP("PENDING");
  const [sel, setSel] = useStateP(M.DECISIONS.find(d => d.status === "RESOLVED_WIN") || M.DECISIONS[0]);

  const resolved = M.DECISIONS.filter(d => d.status === "RESOLVED_WIN" || d.status === "RESOLVED_LOSS" || d.status === "INVALIDATED");
  const pending  = resolved.filter(d => !H.postmortemForDecision(d.decision_id));
  const done     = M.POSTMORTEMS.map(p => ({ pm: p, dec: H.decisionById(p.decision_id) })).filter(x => x.dec);

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[6] · post-mortems · `create_or_update_postmortem()`</div>
          <div className="h-stat lg mt-1">POST-MORTEMS</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            forensic review · separate process quality from outcome luck · error code from `REASON_ERROR_CODES` (26)
          </div>
        </div>
      </div>

      <div className="tabs" style={{ paddingLeft: 24 }}>
        <div className={"tab " + (tab === "PENDING" ? "active" : "")} onClick={() => setTab("PENDING")}>pending ({pending.length})</div>
        <div className={"tab " + (tab === "DONE" ? "active" : "")} onClick={() => setTab("DONE")}>completed ({done.length})</div>
        <div className={"tab " + (tab === "EDITOR" ? "active" : "")} onClick={() => setTab("EDITOR")}>editor</div>
      </div>

      {tab === "PENDING" && (
        <div className="screen-body">
          <div className="col gap-3" style={{ padding: 20 }}>
            {pending.length === 0 && <Empty title="queue clear ✓" hint="all resolved decisions are written up"/>}
            {pending.map(d => (
              <div key={d.decision_id} className="editable-block p-4">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="row gap-2">
                    <span className="mono brand">{H.shortId(d.decision_id, 14)}</span>
                    <Chip>{d.project}</Chip>
                    <Chip kind="warn">{d.status} · NEEDS PM</Chip>
                  </div>
                  <Btn kind="primary" size="sm" onClick={() => { setSel(d); setTab("EDITOR"); }}>▶ WRITE POST-MORTEM</Btn>
                </div>
                <div className="row mt-2 gap-3" style={{ fontSize: 12 }}>
                  <span className="mono">{d.side} {d.outcome} @ {H.fmtPrice(d.price_used)}</span>
                  <span className="dim">·</span>
                  <span className="dim mono">{d.market_title}</span>
                </div>
                <div className="dim mt-2 sans" style={{ fontSize: 12 }}>{d.thesis_summary.slice(0, 200)}…</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "DONE" && (
        <div className="screen-body">
          <div className="col gap-3" style={{ padding: 20 }}>
            {done.map(({ pm, dec }) => (
              <div key={pm.postmortem_id} className="panel p-4" style={{ cursor: "pointer" }} onClick={() => { setSel(dec); setTab("EDITOR"); }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="row gap-2">
                    <span className="mono brand">{H.shortId(dec.decision_id, 14)}</span>
                    <Chip>{dec.project}</Chip>
                    <Chip kind={pm.pnl >= 0 ? "pos" : "neg"}>{dec.status}</Chip>
                  </div>
                  <span className={"mono " + (pm.pnl < 0 ? "neg" : "pos")}>{H.fmtMoney(pm.pnl)}</span>
                </div>
                <div className="row mt-2 gap-2" style={{ fontSize: 11, flexWrap: "wrap" }}>
                  <QualityChip k="thesis"    v={pm.thesis_quality} />
                  <QualityChip k="execution" v={pm.execution_quality} />
                  <QualityChip k="sizing"    v={pm.sizing_quality} />
                  <QualityChip k="exit"      v={pm.exit_quality} />
                  <QualityChip k="rule"      v={pm.rule_read_quality} />
                  {pm.primary_error_type && <span className="evidence-tag">{pm.primary_error_type}</span>}
                  {pm.secondary_error_type && <span className="evidence-tag" style={{ opacity: 0.7 }}>{pm.secondary_error_type}</span>}
                </div>
              </div>
            ))}
            {done.length === 0 && <Empty title="no completed post-mortems" />}
          </div>
        </div>
      )}

      {tab === "EDITOR" && <PostMortemEditor d={sel} go={go} />}
    </div>
  );
}

function QualityChip({ k, v }) {
  if (!v) return <span className="dim mono" style={{ fontSize: 10 }}>{k}: —</span>;
  const tone = v === "EXCELLENT" || v === "GOOD" ? "pos" : v === "OK" ? "draft" : "warn";
  return <span className={"chip chip-" + tone} title={`${k}_quality = ${v}`}><span className="dim mono">{k}:</span>&nbsp;{v}</span>;
}

function PostMortemEditor({ d, go }) {
  const M = window.MOCK;
  const H = window.MOCK_HELPERS;
  const existing = H.postmortemForDecision(d.decision_id);

  const [pnl, setPnl] = useStateP(existing?.pnl ?? 0);
  const [thesisQ, setThesisQ] = useStateP(existing?.thesis_quality ?? "GOOD");
  const [execQ, setExecQ]     = useStateP(existing?.execution_quality ?? "GOOD");
  const [sizeQ, setSizeQ]     = useStateP(existing?.sizing_quality ?? "OK");
  const [exitQ, setExitQ]     = useStateP(existing?.exit_quality ?? "GOOD");
  const [ruleQ, setRuleQ]     = useStateP(existing?.rule_read_quality ?? "GOOD");
  const [primaryErr, setPrimaryErr]     = useStateP(existing?.primary_error_type ?? "");
  const [secondaryErr, setSecondaryErr] = useStateP(existing?.secondary_error_type ?? "");
  const [whatRight, setWhatRight] = useStateP(existing?.what_went_right ?? "");
  const [whatWrong, setWhatWrong] = useStateP(existing?.what_went_wrong ?? "");
  const [lessonKeep, setLessonKeep]     = useStateP(existing?.lesson_keep ?? "");
  const [lessonChange, setLessonChange] = useStateP(existing?.lesson_change ?? "");
  const [neverRepeat, setNeverRepeat]   = useStateP(existing?.never_repeat ?? "");
  const [futureRule, setFutureRule]     = useStateP(existing?.future_rule ?? "");
  const [errorPickerSlot, setErrorPickerSlot] = useStateP("primary");

  useEffectA(() => {
    const e = H.postmortemForDecision(d.decision_id);
    setPnl(e?.pnl ?? 0);
    setThesisQ(e?.thesis_quality ?? "GOOD");
    setExecQ(e?.execution_quality ?? "GOOD");
    setSizeQ(e?.sizing_quality ?? "OK");
    setExitQ(e?.exit_quality ?? "GOOD");
    setRuleQ(e?.rule_read_quality ?? "GOOD");
    setPrimaryErr(e?.primary_error_type ?? "");
    setSecondaryErr(e?.secondary_error_type ?? "");
    setWhatRight(e?.what_went_right ?? "");
    setWhatWrong(e?.what_went_wrong ?? "");
    setLessonKeep(e?.lesson_keep ?? "");
    setLessonChange(e?.lesson_change ?? "");
    setNeverRepeat(e?.never_repeat ?? "");
    setFutureRule(e?.future_rule ?? "");
  }, [d.decision_id]);

  const pickError = (code) => {
    if (errorPickerSlot === "primary") setPrimaryErr(code);
    else setSecondaryErr(code);
  };

  const markdown = buildPmMarkdown({
    d, pnl, thesisQ, execQ, sizeQ, exitQ, ruleQ, primaryErr, secondaryErr,
    whatRight, whatWrong, lessonKeep, lessonChange, neverRepeat, futureRule,
  });

  return (
    <div className="pm-editor">
      {/* LEFT: editor */}
      <div className="pm-pane" style={{ overflowY: "auto" }}>
        <div className="p-4 col gap-4">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row gap-2">
              <span className="mono brand">{H.shortId(d.decision_id, 14)}</span>
              <Chip>{d.project}</Chip>
              <Chip kind={d.status === "RESOLVED_WIN" ? "pos" : d.status === "INVALIDATED" ? "draft" : "neg"}>{d.status}</Chip>
              {existing && <Chip kind="confirmed">SAVED · {H.shortId(existing.postmortem_id, 9)}</Chip>}
            </div>
            <div className="row gap-2">
              <Btn kind="ghost" size="sm">SAVE</Btn>
              <Btn kind="secondary" size="sm" onClick={() => go("packets")}>EXPORT PACKET</Btn>
              <Btn kind="primary" size="sm">✓ COMMIT</Btn>
            </div>
          </div>

          {/* Trade summary — raw read-only */}
          <PMSection title="decision · raw context" raw>
            <table className="tbl">
              <tbody>
                <tr><td className="dim">market</td><td className="mono">{d.market_title}</td></tr>
                <tr><td className="dim">market_slug</td><td className="mono dim">{d.market_slug}</td></tr>
                <tr><td className="dim">side / outcome</td><td className="mono">{d.side} · {d.outcome}</td></tr>
                <tr><td className="dim">price_used</td><td className="mono">{H.fmtPrice(d.price_used)}</td></tr>
                <tr><td className="dim">project / sleeve</td><td className="mono">{d.project} / {d.sleeve}</td></tr>
                <tr><td className="dim">linked fills</td><td className="mono">{H.decisionLinkedTrades(d.decision_id).length}</td></tr>
              </tbody>
            </table>
          </PMSection>

          <PMSection title="original thesis_summary" raw>
            <div className="sans" style={{ fontSize: 13, lineHeight: 1.7 }}>{d.thesis_summary}</div>
          </PMSection>

          <PMSection title="rule_summary + invalidation" raw>
            <div className="sans" style={{ fontSize: 13, lineHeight: 1.7 }}>{d.rule_summary}</div>
            <div className="div-dashed" />
            <div className="sans dim" style={{ fontSize: 12 }}>invalidation: {d.invalidation}</div>
          </PMSection>

          {/* PnL */}
          <PMSection title="pnl · REAL" editable>
            <div className="row gap-2" style={{ alignItems: "center" }}>
              <input className="in" type="number" step="0.01" value={pnl} onChange={e => setPnl(+e.target.value)} style={{ width: 160 }} />
              <span className={"mono " + (pnl < 0 ? "neg" : "pos")} style={{ fontSize: 20 }}>{H.fmtMoney(pnl)}</span>
            </div>
          </PMSection>

          {/* Quality dims — 5 fields with the same 5-value scale */}
          <PMSection title="quality dimensions · TEXT" editable>
            <div className="eval-grid">
              <EvalRow label="thesis_quality"    val={thesisQ} setVal={setThesisQ} />
              <EvalRow label="execution_quality" val={execQ}   setVal={setExecQ} />
              <EvalRow label="sizing_quality"    val={sizeQ}   setVal={setSizeQ} />
              <EvalRow label="exit_quality"      val={exitQ}   setVal={setExitQ} />
              <EvalRow label="rule_read_quality" val={ruleQ}   setVal={setRuleQ} />
            </div>
          </PMSection>

          {/* Error types — picker from REASON_ERROR_CODES */}
          <PMSection title="error types · REASON_ERROR_CODES (26)" editable>
            <div className="row gap-2 mb-3">
              <button className={"target-pick " + (errorPickerSlot === "primary" ? "active" : "")} onClick={() => setErrorPickerSlot("primary")}>primary: {primaryErr || "—"}</button>
              <button className={"target-pick " + (errorPickerSlot === "secondary" ? "active" : "")} onClick={() => setErrorPickerSlot("secondary")}>secondary: {secondaryErr || "—"}</button>
              <Btn kind="ghost" size="sm" onClick={() => (errorPickerSlot === "primary" ? setPrimaryErr("") : setSecondaryErr(""))}>clear slot</Btn>
            </div>
            <div className="col gap-3">
              {M.REASON_GROUPS.map(group => (
                <div key={group.name}>
                  <div className="h-caps" style={{ marginBottom: 6 }}>{group.name}</div>
                  <div className="reason-grid">
                    {group.codes.map(code => {
                      const isPrim = primaryErr === code;
                      const isSec  = secondaryErr === code;
                      return (
                        <button key={code} className={"reason-pick " + (isPrim ? "active primary" : isSec ? "active secondary" : "")} onClick={() => pickError(code)}>
                          {code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </PMSection>

          {/* Narrative fields */}
          <PMSection title="what_went_right" editable>
            <textarea className="in" rows="3" value={whatRight} onChange={e => setWhatRight(e.target.value)} placeholder="what actually worked — process or signal-wise?" />
          </PMSection>
          <PMSection title="what_went_wrong" editable>
            <textarea className="in" rows="3" value={whatWrong} onChange={e => setWhatWrong(e.target.value)} placeholder="be specific. headlines? sizing? timing? rule-read?" />
          </PMSection>

          <div className="grid-2">
            <PMSection title="lesson_keep" editable>
              <textarea className="in" rows="3" value={lessonKeep} onChange={e => setLessonKeep(e.target.value)} placeholder="what behavior should I keep?" />
            </PMSection>
            <PMSection title="lesson_change" editable>
              <textarea className="in" rows="3" value={lessonChange} onChange={e => setLessonChange(e.target.value)} placeholder="what behavior should I change?" />
            </PMSection>
            <PMSection title="never_repeat" editable>
              <textarea className="in" rows="3" value={neverRepeat} onChange={e => setNeverRepeat(e.target.value)} placeholder="what should I never do again?" />
            </PMSection>
            <PMSection title="future_rule" editable>
              <textarea className="in" rows="3" value={futureRule} onChange={e => setFutureRule(e.target.value)} placeholder="codify into the playbook." />
            </PMSection>
          </div>
        </div>
      </div>

      {/* RIGHT: live markdown_body preview */}
      <div className="pm-pane" style={{ background: "var(--bg-0)", borderLeft: "1px solid var(--border-1)" }}>
        <div className="panel-hd">
          <span className="h-comment">markdown_body preview</span>
          <div className="row gap-2">
            <CmdBtn>copy</CmdBtn>
            <CmdBtn>save .md</CmdBtn>
          </div>
        </div>
        <div className="markdown-preview">
          <pre>{markdown}</pre>
        </div>
      </div>
    </div>
  );
}

function buildPmMarkdown(args) {
  const H = window.MOCK_HELPERS;
  const { d, pnl, thesisQ, execQ, sizeQ, exitQ, ruleQ, primaryErr, secondaryErr,
          whatRight, whatWrong, lessonKeep, lessonChange, neverRepeat, futureRule } = args;
  return `# Post-mortem · ${d.decision_id}

**Project:**   ${d.project} / ${d.sleeve}
**Market:**    ${d.market_title}
**Slug:**      ${d.market_slug}
**Position:**  ${d.side} ${d.outcome} @ ${H.fmtPrice(d.price_used)}
**Status:**    ${d.status}
**PnL:**       ${H.fmtMoney(pnl)}

## Quality
| dimension          | value |
|--------------------|-------|
| thesis_quality     | ${thesisQ} |
| execution_quality  | ${execQ} |
| sizing_quality     | ${sizeQ} |
| exit_quality       | ${exitQ} |
| rule_read_quality  | ${ruleQ} |

**primary_error_type:**   ${primaryErr || "—"}
**secondary_error_type:** ${secondaryErr || "—"}

## What went right
${whatRight || "—"}

## What went wrong
${whatWrong || "—"}

## Lessons
- **keep:**         ${lessonKeep || "—"}
- **change:**       ${lessonChange || "—"}
- **never_repeat:** ${neverRepeat || "—"}

## Future rule
${futureRule || "—"}
`;
}

function PMSection({ title, raw, editable, children }) {
  return (
    <div className={raw ? "raw-block p-3" : (editable ? "editable-block p-3" : "panel p-3")}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <span className="h-comment">{title}</span>
        {raw && <Chip kind="immutable">FROM DECISION</Chip>}
        {editable && <span className="evidence-tag">postmortem field</span>}
      </div>
      {children}
    </div>
  );
}

function EvalRow({ label, val, setVal }) {
  const M = window.MOCK;
  return (
    <div className="eval-row">
      <span className="mono dim" style={{ fontSize: 11 }}>{label}</span>
      <div className="row gap-1">
        {M.QUALITY_VALUES.map(q => {
          const active = val === q;
          const tone = q === "EXCELLENT" || q === "GOOD" ? "var(--green)" : q === "OK" ? "var(--cyan)" : "var(--amber)";
          return (
            <button
              key={q}
              onClick={() => setVal(q)}
              className="quality-pick"
              style={{
                background: active ? tone : "transparent",
                color: active ? "#000" : "var(--text-2)",
                borderColor: active ? tone : "var(--border-1)",
              }}
            >
              {q}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================
   EXPORT REVIEW PACKETS  (tabs[7])
   ============================================ */
function ExportPackets({ go }) {
  const M = window.MOCK;
  const H = window.MOCK_HELPERS;
  const [type, setType] = useStateP("ATTRIBUTION");
  const [tradeId, setTradeId] = useStateP("");
  const [decId, setDecId] = useStateP(M.DECISIONS[0].decision_id);
  const [copied, setCopied] = useStateP(false);

  const subject = type === "POSTMORTEM" ? H.decisionById(decId) : { trade: tradeId ? M.TRADES.find(t => t.trade_id === tradeId) : null, dec: decId ? H.decisionById(decId) : null };
  const packet = type === "POSTMORTEM"
    ? buildPostmortemPacket(subject)
    : buildAttributionPacket(subject);

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[7] · export review packets · `export_attribution_packet` / `export_postmortem_packet`</div>
          <div className="h-stat lg mt-1">EXPORT REVIEW PACKETS</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            markdown that you paste into GPT or Claude. Output also saves to <span className="mono">data/processed/</span> via `save_packet`.
          </div>
        </div>
      </div>

      <div className="export-grid">
        <div className="panel p-4 col gap-4">
          <div className="col">
            <label className="in-label">packet_type</label>
            <div className="col gap-2">
              {[
                ["ATTRIBUTION", "export_attribution_packet(conn, trade_id | decision_id)",
                  "Send the trade or decision context to the assistant; ask if it recommended this."],
                ["POSTMORTEM", "export_postmortem_packet(conn, decision_id)",
                  "Send the full thesis + outcome; ask for honest process critique."],
              ].map(([t, sig, desc]) => (
                <button key={t} className={"big-pick " + (type === t ? "active" : "")} onClick={() => setType(t)}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="mono brand">{t}</span>
                    {type === t && <span className="brand">●</span>}
                  </div>
                  <div className="mono dim mt-1" style={{ fontSize: 10, textAlign: "left" }}>{sig}</div>
                  <div className="dim mt-2" style={{ fontSize: 11, textAlign: "left" }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {type === "ATTRIBUTION" && (
            <>
              <div className="col">
                <label className="in-label">trade_id · optional</label>
                <select className="in" value={tradeId} onChange={e => setTradeId(e.target.value)}>
                  <option value="">— none —</option>
                  {M.TRADES.map(t => (
                    <option key={t.trade_id} value={t.trade_id}>
                      {t.trade_id} · {t.side} {t.outcome} @ {H.fmtPrice(t.price)} · {t.market_slug}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col">
                <label className="in-label">decision_id · optional</label>
                <select className="in" value={decId} onChange={e => setDecId(e.target.value)}>
                  <option value="">— none —</option>
                  {M.DECISIONS.map(d => (
                    <option key={d.decision_id} value={d.decision_id}>
                      {H.shortId(d.decision_id, 12)} · {d.project} · {d.side} {d.outcome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dim mono" style={{ fontSize: 10 }}>at least one of (trade_id, decision_id) required.</div>
            </>
          )}

          {type === "POSTMORTEM" && (
            <div className="col">
              <label className="in-label">decision_id · required</label>
              <select className="in" value={decId} onChange={e => setDecId(e.target.value)}>
                {M.DECISIONS.map(d => (
                  <option key={d.decision_id} value={d.decision_id}>
                    {H.shortId(d.decision_id, 12)} · {d.project} · {d.market_title.slice(0, 40)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="div-dashed" />

          <div className="col gap-2">
            <Btn kind="primary" onClick={() => { navigator.clipboard?.writeText(packet).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
              ⌗ COPY MARKDOWN
            </Btn>
            <Btn>$ SAVE → data/processed/{type === "ATTRIBUTION" ? `attribution_${tradeId || decId}.md` : `postmortem_${decId}.md`}</Btn>
            <Btn kind="ghost">$ OPEN_IN_GPT</Btn>
            <Btn kind="ghost">$ OPEN_IN_CLAUDE</Btn>
          </div>
          {copied && <div className="brand mono blink">✓ COPIED TO CLIPBOARD</div>}

          <div className="dim mt-2" style={{ fontSize: 10 }}>
            <span className="warn">⚠</span> the packet is regenerated each call from immutable trades_raw + editable decisions/attributions/postmortems. Pair it with <span className="mono">prompts/attribution_prompt.md</span>.
          </div>
        </div>

        <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="panel-hd">
            <span className="h-comment">packet · markdown · ready to paste</span>
            <span className="mono dim" style={{ fontSize: 10 }}>{packet.length} chars · ~{Math.round(packet.length / 4)} tok</span>
          </div>
          <div className="markdown-preview" style={{ flex: 1, padding: 16 }}>
            <pre>{packet}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildAttributionPacket({ trade, dec }) {
  const H = window.MOCK_HELPERS;
  const head = `# Attribution Review Packet
> generated by polygraph · export_attribution_packet · ${new Date().toISOString().slice(0, 19)}Z

I'm trying to attribute this ${trade ? "fill" : "decision"} to your involvement (or non-involvement).
Pick exactly one of: DIRECT_RECOMMENDATION · SUPPORTED_AFTER_REVIEW · OPPOSED ·
MENTIONED_BUT_NOT_RECOMMENDED · NO_MATCH_FOUND · NOT_INVOLVED · UNCLEAR.
`;
  const tradeBlock = trade ? `
## trade · ${trade.trade_id}
- timestamp:     ${trade.timestamp}
- market_slug:   ${trade.market_slug}
- market_title:  ${trade.market_title}
- outcome:       ${trade.outcome}
- side / action: ${trade.side} / ${trade.action}
- price:         ${H.fmtPrice(trade.price)}
- shares:        ${trade.shares.toFixed(3)}
- notional:      ${H.fmtMoney(trade.notional)}
- fees:          ${H.fmtMoney(trade.fees)}
- source_file:   ${trade.source_file}
` : "";

  const decBlock = dec ? `
## decision · ${dec.decision_id}
- project / sleeve: ${dec.project} / ${dec.sleeve}
- market:           ${dec.market_title}
- side / outcome:   ${dec.side} ${dec.outcome}
- price_used:       ${H.fmtPrice(dec.price_used)}
- intent:           ${dec.intent}
- decision_type:    ${dec.decision_type}
- target_entry:     ${dec.target_entry}
- target_exit:      ${dec.target_exit}
- max_allocation:   ${(dec.max_allocation * 100).toFixed(0)}% NAV
- status:           ${dec.status}

### thesis_summary
${dec.thesis_summary}

### rule_summary
${dec.rule_summary}

### catalyst
${dec.catalyst}

### invalidation
${dec.invalidation}
` : "";

  const ask = `
## return shape
\`\`\`json
{
  "attribution": "<one of the 7 enum values>",
  "evidence":    "<verbatim quote if you can produce one>",
  "evidence_source": "<conversation id / timestamp / approximate anchor>",
  "recommended_price": null,
  "recommended_size":  null,
  "match_quality": 0.0
}
\`\`\`
`;
  return head + tradeBlock + decBlock + ask;
}

function buildPostmortemPacket(d) {
  const H = window.MOCK_HELPERS;
  if (!d) return "";
  const pm = H.postmortemForDecision(d.decision_id);
  return `# Post-Mortem Packet
> generated by polygraph · export_postmortem_packet · ${new Date().toISOString().slice(0, 19)}Z

Decision \`${d.decision_id}\` has resolved (${d.status}). Critique the **process**, not just the outcome.

## decision context
- project / sleeve: ${d.project} / ${d.sleeve}
- market:           ${d.market_title}
- side / outcome:   ${d.side} ${d.outcome} @ ${H.fmtPrice(d.price_used)}
- pnl (so far):     ${pm ? H.fmtMoney(pm.pnl) : "not yet entered"}

### thesis_summary
${d.thesis_summary}

### rule_summary
${d.rule_summary}

### invalidation
${d.invalidation}

## what we want
Please return an honest critique structured as:
\`\`\`
{
  "thesis_quality":    "<EXCELLENT|GOOD|OK|POOR|BAD>",
  "execution_quality": "<...>",
  "sizing_quality":    "<...>",
  "exit_quality":      "<...>",
  "rule_read_quality": "<...>",
  "primary_error_type":   "<one of REASON_ERROR_CODES>",
  "secondary_error_type": "<one of REASON_ERROR_CODES or empty>",
  "what_went_right":   "...",
  "what_went_wrong":   "...",
  "lesson_keep":       "...",
  "lesson_change":     "...",
  "never_repeat":      "...",
  "future_rule":       "..."
}
\`\`\`
`;
}

/* ============================================
   IMPORT TRADES  (tabs[0])
   Mirrors ledger.import_trades.import_trades_csv → ImportResult.
   ============================================ */
function ImportTrades({ go }) {
  const M = window.MOCK;
  const [stage, setStage] = useStateP("DROP"); // DROP · PREVIEW · DONE
  const last = M.IMPORTS[0];

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[0] · import trades · `import_trades_csv()`</div>
          <div className="h-stat lg mt-1">IMPORT TRADES</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            polymarket CSV → `trades_raw` · dedupe by `source_row_hash` · <Chip kind="immutable">APPEND-ONLY</Chip>
          </div>
        </div>
      </div>

      <div className="screen-body" style={{ padding: 24, overflowY: "auto" }}>
        <div className="row gap-3 mb-4" style={{ fontSize: 11 }}>
          {[
            ["DROP", "1 · pick CSV in data/raw_exports/"],
            ["PREVIEW", "2 · preview ImportResult"],
            ["DONE", "3 · commit"]
          ].map(([k, l]) => (
            <div key={k} className={"step " + (stage === k ? "active" : "")}>{l}</div>
          ))}
        </div>

        {stage === "DROP" && (
          <div className="dropzone" onClick={() => setStage("PREVIEW")}>
            <div className="h-stat" style={{ color: "var(--text-1)" }}>⌄ select CSV from data/raw_exports/</div>
            <div className="dim mt-2 mono" style={{ fontSize: 12 }}>or click to browse · accepted: .csv</div>
            <div className="div-dashed" style={{ width: "60%", margin: "20px auto" }} />
            <div className="dim mt-2" style={{ fontSize: 11 }}>
              schema target: trade_id · timestamp · market_slug · market_title · outcome · side · action · price · shares · notional · fees
            </div>
            <div className="mt-4" style={{ fontSize: 11 }}>
              <span className="brand2 mono">last import:</span>{" "}
              <span className="mono dim">{last.source_file}</span>{" "}
              <span className="dim">· {last.imported_at} · +{last.rows_imported} of {last.rows_seen}</span>
            </div>
          </div>
        )}

        {stage === "PREVIEW" && (
          <div className="col gap-4">
            <div className="panel">
              <div className="panel-hd">
                <span className="h-comment">column mapping · csv → trades_raw</span>
                <span className="dim mono">polymarket_export_2026-05-22.csv · 142 rows</span>
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
                <table className="tbl">
                  <thead><tr><th>csv column</th><th></th><th>trades_raw field</th><th>sample</th></tr></thead>
                  <tbody>
                    <tr><td className="mono dim">"timestamp_utc"</td><td className="dim">→</td><td className="mono brand">timestamp</td><td className="mono dim">2026-05-22T14:03:11Z</td></tr>
                    <tr><td className="mono dim">"condition_id"</td><td className="dim">→</td><td className="mono brand">market_slug</td><td className="mono dim">hormuz-normal-end-june-2026</td></tr>
                    <tr><td className="mono dim">"condition_title"</td><td className="dim">→</td><td className="mono brand">market_title</td><td className="mono dim">Hormuz remains operationally…</td></tr>
                    <tr><td className="mono dim">"outcome"</td><td className="dim">→</td><td className="mono brand">outcome</td><td className="mono dim">No</td></tr>
                    <tr><td className="mono dim">"side"</td><td className="dim">→</td><td className="mono brand">side</td><td className="mono dim">BUY</td></tr>
                    <tr><td className="mono dim">"tx_type"</td><td className="dim">→</td><td className="mono brand">action</td><td className="mono dim">TRADE</td></tr>
                    <tr><td className="mono dim">"price_usdc"</td><td className="dim">→</td><td className="mono brand">price</td><td className="mono dim">0.36</td></tr>
                    <tr><td className="mono dim">"shares"</td><td className="dim">→</td><td className="mono brand">shares</td><td className="mono dim">127.789</td></tr>
                    <tr><td className="mono dim">"notional_usdc"</td><td className="dim">→</td><td className="mono brand">notional</td><td className="mono dim">46.00</td></tr>
                    <tr><td className="mono dim">"fee_usdc"</td><td className="dim">→</td><td className="mono brand">fees</td><td className="mono dim">0.092</td></tr>
                    <tr><td className="mono dim">"row_hash"</td><td className="dim">→</td><td className="mono brand">source_row_hash</td><td className="mono dim">a3f9c7…</td></tr>
                    <tr><td className="mono dim">(all)</td><td className="dim">→</td><td className="mono brand">raw_json</td><td className="mono dim">{"{...}"}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid-3">
              <div className="panel p-3">
                <div className="h-caps">rows_seen</div>
                <div className="h-stat dim mt-1">142</div>
              </div>
              <div className="panel p-3">
                <div className="h-caps">rows_imported</div>
                <div className="h-stat pos mt-1">+14</div>
                <div className="dim mt-1" style={{ fontSize: 11 }}>new rows in trades_raw</div>
              </div>
              <div className="panel p-3">
                <div className="h-caps">duplicates_skipped</div>
                <div className="h-stat mt-1">128</div>
                <div className="dim mt-1" style={{ fontSize: 11 }}>matched by source_row_hash</div>
              </div>
              <div className="panel p-3">
                <div className="h-caps">errors</div>
                <div className="h-stat mt-1">0</div>
              </div>
            </div>

            <div className="panel p-3" style={{ borderLeft: "3px solid var(--amber)" }}>
              <div className="row gap-2">
                <span className="warn">⚠</span>
                <span className="warn mono" style={{ fontSize: 11 }}>trades_raw_no_update / trades_raw_no_delete triggers fire on any attempt to mutate</span>
              </div>
              <div className="dim mt-2" style={{ fontSize: 11 }}>
                Once committed these rows cannot be updated or deleted. All edits attach as annotations (decisions, links, attributions, postmortems) and never mutate raw data.
              </div>
            </div>

            <div className="row gap-2">
              <Btn kind="primary" onClick={() => setStage("DONE")}>▶ COMMIT 14 ROWS</Btn>
              <Btn kind="ghost" onClick={() => setStage("DROP")}>CANCEL</Btn>
            </div>
          </div>
        )}

        {stage === "DONE" && (
          <div className="panel p-4">
            <div className="h-comment mb-2">✓ import committed · ImportResult</div>
            <div className="h-stat pos">+14 new fills</div>
            <pre className="mono mt-3" style={{ fontSize: 11, background: "var(--bg-1)", border: "1px solid var(--border-1)", padding: 12, color: "var(--text-1)" }}>
{`{
  "rows_seen": 142,
  "rows_imported": 14,
  "duplicates_skipped": 128,
  "errors": []
}`}
            </pre>
            <div className="div-dashed" />
            <div className="row gap-2">
              <Btn kind="primary" onClick={() => go("unlinked")}>▶ REVIEW UNLINKED ({window.MOCK_HELPERS.unlinkedTrades().length})</Btn>
              <Btn onClick={() => go("ledger")}>OPEN LEDGER</Btn>
              <Btn kind="ghost" onClick={() => setStage("DROP")}>IMPORT ANOTHER</Btn>
            </div>
          </div>
        )}

        {/* History tail */}
        <div className="panel mt-4" style={{ marginTop: 24 }}>
          <div className="panel-hd">
            <span className="h-comment">recent import runs</span>
            <span className="dim mono" style={{ fontSize: 10 }}>data/raw_exports/</span>
          </div>
          <table className="tbl">
            <thead><tr><th>imported_at</th><th>source_file</th><th className="num">seen</th><th className="num">+imported</th><th className="num">dupes</th><th className="num">errors</th></tr></thead>
            <tbody>
              {M.IMPORTS.map(im => (
                <tr key={im.imported_at}>
                  <td className="id mono">{im.imported_at}</td>
                  <td className="mono dim">{im.source_file}</td>
                  <td className="num mono">{im.rows_seen}</td>
                  <td className="num pos">+{im.rows_imported}</td>
                  <td className="num dim">{im.duplicates_skipped}</td>
                  <td className={"num " + (im.errors ? "neg" : "dim")}>{im.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PostMortems, ExportPackets, ImportTrades });
