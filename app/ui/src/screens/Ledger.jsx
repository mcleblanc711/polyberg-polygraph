import { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { PROJECTS } from '../constants.js'
import { Chip, Btn, CmdBtn, Drawer, IdMono, ReviewStatus, Empty } from '../components.jsx'
import { fmtPrice, fmtMoney, shortId, fmtTs } from '../constants.js'

export default function Ledger({ go }) {
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)

  const [project, setProject] = useState('')
  const [marketText, setMarketText] = useState('')
  const [outcome, setOutcome] = useState('')
  const [side, setSide] = useState('')
  const [action, setAction] = useState('')
  const [linkFilter, setLinkFilter] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setLoading(true)
    api.trades({ project, market_text: marketText, outcome, side, action, linked: linkFilter || undefined })
      .then(data => setTrades(Array.isArray(data) ? data : (data.trades || [])))
      .catch(() => setTrades([]))
      .finally(() => setLoading(false))
  }, [project, marketText, outcome, side, action, linkFilter])

  return (
    <div className="screen ledger">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[2] · trade ledger · fetch_trades()</div>
          <div className="h-stat lg mt-1">TRADE LEDGER</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            <Chip kind="immutable">trades_raw · APPEND-ONLY</Chip>
            <span className="dim" style={{ marginLeft: 8 }}>annotations attach to rows; raw fills never mutate. dedupe by source_row_hash.</span>
          </div>
        </div>
        <div className="row gap-2">
          <Btn kind="ghost" size="sm" onClick={() => go('packets')}>⌄ EXPORT REVIEW PACKET</Btn>
          <Btn kind="ghost" size="sm" onClick={() => go('import')}>+ IMPORT CSV</Btn>
        </div>
      </div>

      <div className="filter-bar">
        <div className="col" style={{ flex: 1 }}>
          <label className="in-label">market contains</label>
          <input className="in" placeholder="slug, title or trade_id…" value={marketText} onChange={e => setMarketText(e.target.value)} />
        </div>
        <div className="col">
          <label className="in-label">project</label>
          <select className="in" value={project} onChange={e => setProject(e.target.value)} style={{ width: 200 }}>
            <option value="">all</option>
            {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
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
            <option value="">all</option>
            <option value="true">linked</option>
            <option value="false">unlinked</option>
          </select>
        </div>
        <div className="col" style={{ alignSelf: 'flex-end' }}>
          <div className="dim mono" style={{ fontSize: 10 }}>{loading ? '…' : trades.length} rows</div>
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
            {trades.map(t => {
              const decId = t.linked_decision_ids ? t.linked_decision_ids.split(',')[0] : null
              return (
                <tr key={t.trade_id} onClick={() => setSelected(t)} className={selected?.trade_id === t.trade_id ? 'selected' : ''} style={{ cursor: 'pointer' }}>
                  <td className="id mono">{fmtTs(t.timestamp)}</td>
                  <td><span className="mono brand">{shortId(t.trade_id, 10)}</span></td>
                  <td>{t.project ? <span className="brand mono" style={{ fontSize: 10 }}>{t.project}</span> : <span className="dim">—</span>}</td>
                  <td className="mono dim" style={{ fontSize: 10 }}>{t.sleeve || '—'}</td>
                  <td style={{ maxWidth: 280 }}>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.market_title}</div>
                    <div className="dim mono" style={{ fontSize: 9 }}>{t.market_slug}</div>
                  </td>
                  <td><Chip kind={t.outcome === 'Yes' ? 'yes' : 'no'}>{t.outcome}</Chip></td>
                  <td><span className={t.side === 'BUY' ? 'pos' : 'neg'}>{t.side}</span></td>
                  <td className="mono dim" style={{ fontSize: 10 }}>{t.action}</td>
                  <td className="num mono">{fmtPrice(t.price)}</td>
                  <td className="num mono dim">{(+t.shares).toFixed(3)}</td>
                  <td className="num mono">{fmtMoney(t.notional)}</td>
                  <td className="num mono dim" style={{ fontSize: 10 }}>{fmtMoney(t.fees)}</td>
                  <td>
                    {decId
                      ? <span className="mono brand" style={{ fontSize: 10 }}>{shortId(decId, 10)}</span>
                      : <span className="warn mono" style={{ fontSize: 10 }}>UNLINKED</span>
                    }
                  </td>
                  <td>
                    {t.attr_count > 0
                      ? <span className="mono dim" style={{ fontSize: 10 }}>{t.attr_count}×</span>
                      : <span className="dim">—</span>}
                  </td>
                  <td><span className="dim" style={{ fontSize: 10 }}>→</span></td>
                </tr>
              )
            })}
            {!loading && trades.length === 0 && (
              <tr><td colSpan="15"><Empty title="no fills match these filters" hint="loosen the criteria, or import another CSV" /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `// ${selected.trade_id}` : ''}>
        {selected && <TradeDrawer t={selected} go={go} />}
      </Drawer>
    </div>
  )
}

function TradeDrawer({ t, go }) {
  const [attrs, setAttrs] = useState([])
  useEffect(() => {
    api.attributionsByTrade(t.trade_id).then(setAttrs).catch(() => setAttrs([]))
  }, [t.trade_id])

  const decIds = t.linked_decision_ids ? t.linked_decision_ids.split(',').filter(Boolean) : []

  return (
    <div style={{ padding: 16 }}>
      <div className="col gap-4">
        <div className="raw-block p-3">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="h-caps">trades_raw · row (immutable)</div>
            <Chip kind="immutable">APPEND-ONLY</Chip>
          </div>
          <div className="kv">
            <div><span className="k">trade_id</span><span className="v"><IdMono id={t.trade_id} /></span></div>
            <div><span className="k">timestamp</span><span className="v mono">{t.timestamp}</span></div>
            <div><span className="k">source_file</span><span className="v mono dim">{t.source_file}</span></div>
            <div><span className="k">source_row_hash</span><span className="v mono dim" style={{ fontSize: 10 }}>{t.source_row_hash}</span></div>
            <div><span className="k">market_slug</span><span className="v mono">{t.market_slug}</span></div>
            <div><span className="k">market_title</span><span className="v">{t.market_title}</span></div>
            <div><span className="k">outcome</span><span className="v"><Chip kind={t.outcome === 'Yes' ? 'yes' : 'no'}>{t.outcome}</Chip></span></div>
            <div><span className="k">side / action</span><span className="v"><span className={t.side === 'BUY' ? 'pos' : 'neg'}>{t.side}</span> · <span className="mono dim">{t.action}</span></span></div>
            <div><span className="k">price</span><span className="v mono">{fmtPrice(t.price)}</span></div>
            <div><span className="k">shares</span><span className="v mono">{(+t.shares).toFixed(3)}</span></div>
            <div><span className="k">notional</span><span className="v mono">{fmtMoney(t.notional)}</span></div>
            <div><span className="k">fees</span><span className="v mono dim">{fmtMoney(t.fees)}</span></div>
          </div>
        </div>

        <div className="editable-block p-3">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="h-caps brand">trade_decision_links</div>
            <CmdBtn onClick={() => go('unlinked')}>link decision</CmdBtn>
          </div>
          {decIds.length === 0
            ? <div className="dim" style={{ fontSize: 11 }}>no links · open the Unlinked Trades queue to attach this fill to a decision.</div>
            : (
              <table className="tbl" style={{ background: 'transparent' }}>
                <thead><tr><th>decision_id</th><th>project</th></tr></thead>
                <tbody>
                  {decIds.map(id => (
                    <tr key={id} style={{ cursor: 'pointer' }} onClick={() => go('decisions')}>
                      <td><span className="mono brand">{shortId(id, 12)}</span></td>
                      <td><span className="mono dim">{t.linked_projects || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        <div className="editable-block p-3">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="h-caps brand">assistant_attributions · WHERE trade_id = ?</div>
            <CmdBtn onClick={() => go('attribution')}>open</CmdBtn>
          </div>
          {attrs.length === 0
            ? <div className="dim" style={{ fontSize: 11 }}>no row-level attributions. transcript imports drop NEEDS_REVIEW rows here when a turn matches by slug/title.</div>
            : (
              <div className="col gap-2">
                {attrs.map(a => (
                  <div key={a.attribution_id} className="row" style={{ justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px dashed var(--border-1)' }}>
                    <span className="mono dim">{a.assistant}</span>
                    <span className="mono">{a.attribution}</span>
                    <span className="mono brand">{((a.match_quality || 0) * 100).toFixed(0)}%</span>
                    <ReviewStatus status={a.review_status} />
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
