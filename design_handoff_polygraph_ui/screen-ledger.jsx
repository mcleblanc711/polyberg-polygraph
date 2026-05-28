/* ============================================
   Polygraph — Trade Ledger + Unlinked Trades
   Columns/filters mirror app/streamlit_app.py tabs[2]+tabs[3]
   and ledger.services.fetch_trades / fetch_unlinked_trades.
   ============================================ */
const { useState: useStateL, useMemo: useMemoL } = React;

function TradeLedger({ go }) {
  const M = window.MOCK;
  const H = window.MOCK_HELPERS;

  const [project, setProject]   = useStateL("ALL");
  const [marketText, setMarketText] = useStateL("");
  const [outcome, setOutcome]   = useStateL("");
  const [side, setSide]         = useStateL("");
  const [action, setAction]     = useStateL("");
  const [linkFilter, setLinkFilter] = useStateL("ALL");  // ALL · LINKED · UNLINKED
  const [selected, setSelected] = useStateL(null);

  const rows = useMemoL(() => {
    return M.TRADES.filter(t => {
      if (project !== "ALL" && H.tradeProject(t) !== project) return false;
      if (marketText && !(`${t.market_slug} ${t.market_title}`.toLowerCase().includes(marketText.toLowerCase())) && !t.trade_id.includes(marketText.toLowerCase())) return false;
      if (outcome && t.outcome !== outcome) return false;
      if (side && t.side !== side) return false;
      if (action && t.action !== action) return false;
      if (linkFilter === "LINKED" && !H.isLinked(t)) return false;
      if (linkFilter === "UNLINKED" && H.isLinked(t)) return false;
      return true;
    });
  }, [project, marketText, outcome, side, action, linkFilter]);

  return (
    <div className="screen ledger">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[2] · trade ledger · `fetch_trades()`</div>
          <div className="h-stat lg mt-1">TRADE LEDGER</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            <Chip kind="immutable">trades_raw · APPEND-ONLY</Chip>
            <span className="dim" style={{ marginLeft: 8 }}>annotations attach to rows; raw fills never mutate. dedupe by source_row_hash.</span>
          </div>
        </div>
        <div className="row gap-2">
          <Btn kind="ghost" size="sm" onClick={() => go("packets")}>⌄ EXPORT REVIEW PACKET</Btn>
          <Btn kind="ghost" size="sm" onClick={() => go("import")}>+ IMPORT CSV</Btn>
        </div>
      </div>

      {/* Filter bar — fields match fetch_trades signature */}
      <div className="filter-bar">
        <div className="col" style={{ flex: 1 }}>
          <label className="in-label">market contains</label>
          <input className="in" placeholder="slug, title or trade_id…" value={marketText} onChange={e => setMarketText(e.target.value)} />
        </div>
        <div className="col">
          <label className="in-label">project</label>
          <select className="in" value={project} onChange={e => setProject(e.target.value)} style={{ width: 200 }}>
            <option value="ALL">all</option>
            {M.PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="col">
          <label className="in-label">outcome</label>
          <select className="in" value={outcome} onChange={e => setOutcome(e.target.value)} style={{ width: 90 }}>
            <option value="">any</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        <div className="col">
          <label className="in-label">side</label>
          <select className="in" value={side} onChange={e => setSide(e.target.value)} style={{ width: 90 }}>
            <option value="">any</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </div>
        <div className="col">
          <label className="in-label">action</label>
          <select className="in" value={action} onChange={e => setAction(e.target.value)} style={{ width: 120 }}>
            <option value="">any</option>
            <option value="TRADE">TRADE</option>
            <option value="REDEMPTION">REDEMPTION</option>
            <option value="MERGE">MERGE</option>
            <option value="SPLIT">SPLIT</option>
          </select>
        </div>
        <div className="col">
          <label className="in-label">link status</label>
          <select className="in" value={linkFilter} onChange={e => setLinkFilter(e.target.value)} style={{ width: 120 }}>
            <option value="ALL">all</option>
            <option value="LINKED">linked</option>
            <option value="UNLINKED">unlinked</option>
          </select>
        </div>
        <div className="col" style={{ alignSelf: "flex-end" }}>
          <div className="dim mono" style={{ fontSize: 10 }}>{rows.length} of {M.TRADES.length}</div>
        </div>
      </div>

      <div className="ledger-table">
        <table className="tbl">
          <thead>
            <tr>
              <th>timestamp</th>
              <th>trade_id</th>
              <th>project</th>
              <th>sleeve</th>
              <th>market</th>
              <th>out</th>
              <th>side</th>
              <th>action</th>
              <th className="num">price</th>
              <th className="num">shares</th>
              <th className="num">notional</th>
              <th className="num">fees</th>
              <th>linked decision</th>
              <th>attr</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => {
              const decIds = H.tradeLinkedDecisionIds(t);
              const proj = H.tradeProject(t);
              const sleeve = H.tradeSleeve(t);
              const attrs = H.attributionsForTrade(t.trade_id);
              return (
                <tr key={t.trade_id} onClick={() => setSelected(t)} className={selected?.trade_id === t.trade_id ? "selected" : ""} style={{ cursor: "pointer" }}>
                  <td className="id mono">{t.timestamp.replace("T", " ").replace("Z", "")}</td>
                  <td><span className="mono brand">{t.trade_id}</span></td>
                  <td>{proj ? <span className="brand mono" style={{ fontSize: 10 }}>{proj}</span> : <span className="dim">—</span>}</td>
                  <td className="mono dim" style={{ fontSize: 10 }}>{sleeve || "—"}</td>
                  <td style={{ maxWidth: 280 }}>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.market_title}</div>
                    <div className="dim mono" style={{ fontSize: 9 }}>{t.market_slug}</div>
                  </td>
                  <td><Chip kind={t.outcome === "Yes" ? "yes" : "no"}>{t.outcome}</Chip></td>
                  <td><span className={t.side === "BUY" ? "pos" : "neg"}>{t.side}</span></td>
                  <td className="mono dim" style={{ fontSize: 10 }}>{t.action}</td>
                  <td className="num mono">{H.fmtPrice(t.price)}</td>
                  <td className="num mono dim">{t.shares.toFixed(3)}</td>
                  <td className="num mono">{H.fmtMoney(t.notional)}</td>
                  <td className="num mono dim" style={{ fontSize: 10 }}>{H.fmtMoney(t.fees)}</td>
                  <td>
                    {decIds.length > 0
                      ? <span className="mono brand" style={{ fontSize: 10 }}>{H.shortId(decIds[0])}</span>
                      : <span className="warn mono" style={{ fontSize: 10 }}>UNLINKED</span>
                    }
                  </td>
                  <td>
                    {attrs.length > 0
                      ? <span className="mono dim" style={{ fontSize: 10 }}>{attrs.length}×</span>
                      : <span className="dim">—</span>}
                  </td>
                  <td><span className="dim" style={{ fontSize: 10 }}>→</span></td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan="15"><Empty title="no fills match these filters" hint="loosen the criteria, or import another CSV"/></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `// ${selected.trade_id}` : ""}>
        {selected && <TradeDrawer t={selected} go={go} />}
      </Drawer>
    </div>
  );
}

function TradeDrawer({ t, go }) {
  const H = window.MOCK_HELPERS;
  const decIds = H.tradeLinkedDecisionIds(t);
  const decisions = decIds.map(H.decisionById).filter(Boolean);
  const attrs = H.attributionsForTrade(t.trade_id);
  return (
    <div style={{ padding: 16 }}>
      <div className="col gap-4">
        {/* Raw section — full schema */}
        <div className="raw-block p-3">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div className="h-caps">trades_raw · row (immutable)</div>
            <Chip kind="immutable">APPEND-ONLY</Chip>
          </div>
          <div className="kv">
            <div><span className="k">trade_id</span><span className="v"><IdMono id={t.trade_id} /></span></div>
            <div><span className="k">timestamp</span><span className="v mono">{t.timestamp}</span></div>
            <div><span className="k">imported_at</span><span className="v mono dim">{t.imported_at}</span></div>
            <div><span className="k">source_file</span><span className="v mono dim">{t.source_file}</span></div>
            <div><span className="k">source_row_hash</span><span className="v mono dim" style={{ fontSize: 10 }}>{t.source_row_hash}</span></div>
            <div><span className="k">market_slug</span><span className="v mono">{t.market_slug}</span></div>
            <div><span className="k">market_title</span><span className="v">{t.market_title}</span></div>
            <div><span className="k">outcome</span><span className="v"><Chip kind={t.outcome === "Yes" ? "yes" : "no"}>{t.outcome}</Chip></span></div>
            <div><span className="k">side / action</span><span className="v"><span className={t.side === "BUY" ? "pos" : "neg"}>{t.side}</span> · <span className="mono dim">{t.action}</span></span></div>
            <div><span className="k">price</span><span className="v mono">{H.fmtPrice(t.price)}</span></div>
            <div><span className="k">shares</span><span className="v mono">{t.shares.toFixed(3)}</span></div>
            <div><span className="k">notional</span><span className="v mono">{H.fmtMoney(t.notional)}</span></div>
            <div><span className="k">fees</span><span className="v mono dim">{H.fmtMoney(t.fees)}</span></div>
          </div>
        </div>

        {/* Editable: links + attributions */}
        <div className="editable-block p-3">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div className="h-caps brand">trade_decision_links</div>
            <CmdBtn onClick={() => go("unlinked")}>link decision</CmdBtn>
          </div>
          {decisions.length === 0
            ? <div className="dim" style={{ fontSize: 11 }}>no links · open the Unlinked Trades queue to attach this fill to a decision.</div>
            : (
              <table className="tbl" style={{ background: "transparent" }}>
                <thead><tr><th>decision_id</th><th>project</th><th className="num">confidence</th><th>method</th></tr></thead>
                <tbody>
                  {decIds.map(id => {
                    const dec = H.decisionById(id);
                    const link = window.MOCK.LINKS.find(l => l.trade_id === t.trade_id && l.decision_id === id);
                    return (
                      <tr key={id} style={{ cursor: "pointer" }} onClick={() => go("decisions")}>
                        <td><span className="mono brand">{H.shortId(id, 10)}</span></td>
                        <td><span className="mono dim">{dec?.project}</span></td>
                        <td className="num mono">{(link.link_confidence * 100).toFixed(0)}%</td>
                        <td className="mono dim">{link.link_method}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>

        {/* Attributions on this trade row (not the decision) */}
        <div className="editable-block p-3">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div className="h-caps brand">assistant_attributions · WHERE trade_id = ?</div>
            <CmdBtn onClick={() => go("attribution")}>open</CmdBtn>
          </div>
          {attrs.length === 0
            ? <div className="dim" style={{ fontSize: 11 }}>no row-level attributions. transcript imports drop NEEDS_REVIEW rows here when a turn matches by slug/title.</div>
            : (
              <div className="col gap-2">
                {attrs.map(a => (
                  <div key={a.attribution_id} className="row" style={{ justifyContent: "space-between", fontSize: 11, padding: "4px 0", borderBottom: "1px dashed var(--border-1)" }}>
                    <span className="mono dim">{a.assistant}</span>
                    <span className="mono">{a.attribution}</span>
                    <span className="mono brand">{(a.match_quality * 100).toFixed(0)}%</span>
                    <ReviewStatus status={a.review_status} />
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

/* ============================================
   Unlinked Trades — tabs[3] · `fetch_unlinked_trades` + `suggest_candidate_groups`
   ============================================ */
function UnlinkedTrades({ go }) {
  const M = window.MOCK;
  const H = window.MOCK_HELPERS;
  const [selectedTradeIds, setSelectedTradeIds] = useStateL(() => new Set());
  const [decId, setDecId] = useStateL(M.DECISIONS[0].decision_id);
  const [confidence, setConfidence] = useStateL(1.0);
  const [linkMethod, setLinkMethod] = useStateL("USER");

  const unlinked = H.unlinkedTrades();
  // candidate groups: cluster by market_slug + outcome + side, prox timestamp & price (mirrors grouping.suggest_candidate_groups intent)
  const groups = useMemoL(() => {
    const buckets = {};
    unlinked.forEach(t => {
      const key = `${t.market_slug}|${t.outcome}|${t.side}|${t.action}`;
      if (!buckets[key]) buckets[key] = { market_slug: t.market_slug, market_title: t.market_title, outcome: t.outcome, side: t.side, action: t.action, trades: [] };
      buckets[key].trades.push(t);
    });
    return Object.values(buckets);
  }, [unlinked.length]);

  const toggle = (id) => {
    const next = new Set(selectedTradeIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedTradeIds(next);
  };

  return (
    <div className="screen unlinked">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[3] · unlinked trades · `link_trades_to_decision()`</div>
          <div className="h-stat lg mt-1">UNLINKED TRADES</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            {unlinked.length} fills awaiting a `trade_decision_links` row. Suggestions never auto-confirm — every link is user-confirmed.
          </div>
        </div>
      </div>

      <div className="screen-body" style={{ padding: 24, overflowY: "auto" }}>
        <div className="col gap-4">
          {/* All unlinked fills table */}
          <div className="panel">
            <div className="panel-hd">
              <span className="h-comment">all unlinked fills · {unlinked.length}</span>
              <div className="row gap-2">
                <span className="dim mono" style={{ fontSize: 10 }}>{selectedTradeIds.size} selected</span>
                <CmdBtn onClick={() => setSelectedTradeIds(new Set(unlinked.map(t => t.trade_id)))}>select all</CmdBtn>
                <CmdBtn onClick={() => setSelectedTradeIds(new Set())}>clear</CmdBtn>
              </div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 28 }}></th>
                  <th>trade_id</th>
                  <th>timestamp</th>
                  <th>market</th>
                  <th>out</th>
                  <th>side</th>
                  <th>action</th>
                  <th className="num">price</th>
                  <th className="num">shares</th>
                  <th className="num">notional</th>
                </tr>
              </thead>
              <tbody>
                {unlinked.map(t => {
                  const checked = selectedTradeIds.has(t.trade_id);
                  return (
                    <tr key={t.trade_id} onClick={() => toggle(t.trade_id)} className={checked ? "selected" : ""} style={{ cursor: "pointer" }}>
                      <td><span style={{
                        display: "inline-block", width: 12, height: 12,
                        border: "1px solid var(--border-2)",
                        background: checked ? "var(--magenta)" : "transparent",
                      }} /></td>
                      <td><span className="mono brand">{t.trade_id}</span></td>
                      <td className="id mono">{t.timestamp.replace("T", " ").replace("Z", "")}</td>
                      <td className="mono" style={{ fontSize: 11, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>{t.market_title}</td>
                      <td><Chip kind={t.outcome === "Yes" ? "yes" : "no"}>{t.outcome}</Chip></td>
                      <td><span className={t.side === "BUY" ? "pos" : "neg"}>{t.side}</span></td>
                      <td className="mono dim" style={{ fontSize: 10 }}>{t.action}</td>
                      <td className="num mono">{H.fmtPrice(t.price)}</td>
                      <td className="num mono dim">{t.shares.toFixed(3)}</td>
                      <td className="num mono">{H.fmtMoney(t.notional)}</td>
                    </tr>
                  );
                })}
                {unlinked.length === 0 && (
                  <tr><td colSpan="10"><Empty title="queue clear ✓" hint="every fill is linked to a decision"/></td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Suggested groups */}
          <div className="panel">
            <div className="panel-hd">
              <span className="h-comment">suggested groups · `grouping.suggest_candidate_groups`</span>
              <span className="dim mono" style={{ fontSize: 10 }}>cluster by market + outcome + side/action + temporal/price proximity</span>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>market</th>
                  <th>out</th>
                  <th>side / action</th>
                  <th className="num">fills</th>
                  <th className="num">avg px</th>
                  <th className="num">notional</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g, i) => (
                  <tr key={i}>
                    <td>
                      <div className="mono" style={{ fontSize: 11 }}>{g.market_title}</div>
                      <div className="dim mono" style={{ fontSize: 9 }}>{g.market_slug}</div>
                    </td>
                    <td><Chip kind={g.outcome === "Yes" ? "yes" : "no"}>{g.outcome}</Chip></td>
                    <td><span className={g.side === "BUY" ? "pos" : "neg"}>{g.side}</span> · <span className="mono dim">{g.action}</span></td>
                    <td className="num mono">{g.trades.length}</td>
                    <td className="num mono">{H.fmtPrice(g.trades.reduce((s, t) => s + t.price, 0) / g.trades.length)}</td>
                    <td className="num mono">{H.fmtMoney(g.trades.reduce((s, t) => s + t.notional, 0))}</td>
                    <td>
                      <CmdBtn onClick={() => setSelectedTradeIds(new Set(g.trades.map(t => t.trade_id)))}>select group</CmdBtn>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && <tr><td colSpan="7" className="dim" style={{ padding: 12 }}>—</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Link form */}
          <div className="editable-block p-4">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="h-caps brand">link_trades_to_decision(conn, trade_ids, decision_id, link_confidence, link_method)</div>
              <Chip kind="proposed">{selectedTradeIds.size} TRADES SELECTED</Chip>
            </div>
            <div className="row gap-3 mt-3" style={{ alignItems: "flex-end" }}>
              <div className="col" style={{ flex: 1 }}>
                <label className="in-label">decision_id</label>
                <select className="in" value={decId} onChange={e => setDecId(e.target.value)}>
                  {M.DECISIONS.map(d => (
                    <option key={d.decision_id} value={d.decision_id}>
                      {H.shortId(d.decision_id, 10)} · {d.project} · {d.side} {d.outcome} @ {H.fmtPrice(d.price_used)} · {d.market_title.slice(0, 40)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col" style={{ width: 240 }}>
                <label className="in-label">link_confidence · {confidence.toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.05" value={confidence} onChange={e => setConfidence(+e.target.value)} style={{ accentColor: "var(--magenta)" }} />
              </div>
              <div className="col">
                <label className="in-label">link_method</label>
                <select className="in" value={linkMethod} onChange={e => setLinkMethod(e.target.value)} style={{ width: 140 }}>
                  <option value="USER">USER</option>
                  <option value="SUGGESTED">SUGGESTED</option>
                </select>
              </div>
              <Btn kind="primary" disabled={!selectedTradeIds.size}>▶ LINK {selectedTradeIds.size || ""}</Btn>
              <Btn>+ CREATE DECISION & LINK</Btn>
            </div>
            <div className="dim mt-2" style={{ fontSize: 10 }}>
              <span className="warn">⚠</span> link rows live in `trade_decision_links`. Many-to-many: one decision can cover many fills; one fill may have multiple decision links.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TradeLedger, UnlinkedTrades });
