import { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { Chip, Btn, CmdBtn, Empty } from '../components.jsx'
import { fmtPrice, fmtMoney, shortId } from '../constants.js'

export default function Unlinked({ go, onDone }) {
  const [unlinked, setUnlinked] = useState([])
  const [groups, setGroups] = useState([])
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedIds, setSelectedIds] = useState(new Set())
  const [decId, setDecId] = useState('')
  const [confidence, setConfidence] = useState(1.0)
  const [linkMethod, setLinkMethod] = useState('USER')
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    Promise.all([
      api.unlinkedTrades(),
      api.groups(),
      api.decisions(),
    ]).then(([u, g, d]) => {
      setUnlinked(Array.isArray(u) ? u : (u.trades || []))
      setGroups(Array.isArray(g) ? g : (g.groups || []))
      const decs = Array.isArray(d) ? d : (d.decisions || [])
      setDecisions(decs)
      if (decs.length > 0) setDecId(decs[0].decision_id)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggle = (id) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  const doLink = async () => {
    if (!selectedIds.size || !decId) return
    setLinking(true)
    setError(null)
    try {
      await api.linkTrades({ trade_ids: [...selectedIds], decision_id: decId, link_confidence: confidence, link_method: linkMethod })
      const fresh = await api.unlinkedTrades()
      setUnlinked(Array.isArray(fresh) ? fresh : (fresh.trades || []))
      setSelectedIds(new Set())
      onDone?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="screen unlinked">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[3] · unlinked trades · link_trades_to_decision()</div>
          <div className="h-stat lg mt-1">UNLINKED TRADES</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            {unlinked.length} fills awaiting a <span className="mono">trade_decision_links</span> row. Suggestions never auto-confirm — every link is user-confirmed.
          </div>
        </div>
      </div>

      <div className="screen-body" style={{ padding: 24, overflowY: 'auto' }}>
        {error && (
          <div className="panel p-3 mb-4" style={{ borderLeft: '3px solid var(--red)' }}>
            <span className="neg mono" style={{ fontSize: 11 }}>⚠ {error}</span>
          </div>
        )}

        <div className="col gap-4">
          <div className="panel">
            <div className="panel-hd">
              <span className="h-comment">all unlinked fills · {unlinked.length}</span>
              <div className="row gap-2">
                <span className="dim mono" style={{ fontSize: 10 }}>{selectedIds.size} selected</span>
                <CmdBtn onClick={() => setSelectedIds(new Set(unlinked.map(t => t.trade_id)))}>select all</CmdBtn>
                <CmdBtn onClick={() => setSelectedIds(new Set())}>clear</CmdBtn>
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
                  const checked = selectedIds.has(t.trade_id)
                  return (
                    <tr key={t.trade_id} onClick={() => toggle(t.trade_id)} className={checked ? 'selected' : ''} style={{ cursor: 'pointer' }}>
                      <td>
                        <span style={{ display: 'inline-block', width: 12, height: 12, border: '1px solid var(--border-2)', background: checked ? 'var(--magenta)' : 'transparent' }} />
                      </td>
                      <td><span className="mono brand">{shortId(t.trade_id, 10)}</span></td>
                      <td className="id mono">{String(t.timestamp).replace('T', ' ').replace('Z', '')}</td>
                      <td className="mono" style={{ fontSize: 11, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.market_title}</td>
                      <td><Chip kind={t.outcome === 'Yes' ? 'yes' : 'no'}>{t.outcome}</Chip></td>
                      <td><span className={t.side === 'BUY' ? 'pos' : 'neg'}>{t.side}</span></td>
                      <td className="mono dim" style={{ fontSize: 10 }}>{t.action}</td>
                      <td className="num mono">{fmtPrice(t.price)}</td>
                      <td className="num mono dim">{(+t.shares).toFixed(3)}</td>
                      <td className="num mono">{fmtMoney(t.notional)}</td>
                    </tr>
                  )
                })}
                {!loading && unlinked.length === 0 && (
                  <tr><td colSpan="10"><Empty title="queue clear ✓" hint="every fill is linked to a decision" /></td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <div className="panel-hd">
              <span className="h-comment">suggested groups · grouping.suggest_candidate_groups</span>
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
                      <div className="mono" style={{ fontSize: 11 }}>{g.market_title || g.market_slug}</div>
                      <div className="dim mono" style={{ fontSize: 9 }}>{g.market_slug}</div>
                    </td>
                    <td><Chip kind={g.outcome === 'Yes' ? 'yes' : 'no'}>{g.outcome}</Chip></td>
                    <td><span className={g.side === 'BUY' ? 'pos' : 'neg'}>{g.side}</span> · <span className="mono dim">{g.action}</span></td>
                    <td className="num mono">{g.count ?? g.trade_ids?.length ?? 0}</td>
                    <td className="num mono">{fmtPrice(g.avg_price)}</td>
                    <td className="num mono">{fmtMoney(g.total_notional)}</td>
                    <td>
                      <CmdBtn onClick={() => {
                        const ids = g.trade_ids || unlinked.filter(t => t.market_slug === g.market_slug && t.outcome === g.outcome && t.side === g.side).map(t => t.trade_id)
                        setSelectedIds(new Set(ids))
                      }}>select group</CmdBtn>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && <tr><td colSpan="7" className="dim" style={{ padding: 12 }}>—</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="editable-block p-4">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="h-caps brand">link_trades_to_decision(conn, trade_ids, decision_id, link_confidence, link_method)</div>
              <Chip kind="proposed">{selectedIds.size} TRADES SELECTED</Chip>
            </div>
            <div className="row gap-3 mt-3" style={{ alignItems: 'flex-end' }}>
              <div className="col" style={{ flex: 1 }}>
                <label className="in-label">decision_id</label>
                <select className="in" value={decId} onChange={e => setDecId(e.target.value)}>
                  {decisions.map(d => (
                    <option key={d.decision_id} value={d.decision_id}>
                      {shortId(d.decision_id, 10)} · {d.project} · {d.side} {d.outcome} @ {fmtPrice(d.price_used)} · {(d.market_title || '').slice(0, 40)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col" style={{ width: 240 }}>
                <label className="in-label">link_confidence · {confidence.toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.05" value={confidence} onChange={e => setConfidence(+e.target.value)} style={{ accentColor: 'var(--magenta)' }} />
              </div>
              <div className="col">
                <label className="in-label">link_method</label>
                <select className="in" value={linkMethod} onChange={e => setLinkMethod(e.target.value)} style={{ width: 140 }}>
                  <option value="USER">USER</option>
                  <option value="SUGGESTED">SUGGESTED</option>
                </select>
              </div>
              <Btn kind="primary" disabled={!selectedIds.size || linking} onClick={doLink}>
                ▶ LINK {selectedIds.size || ''}
              </Btn>
              <Btn onClick={() => go('decisions')}>+ CREATE DECISION & LINK</Btn>
            </div>
            <div className="dim mt-2" style={{ fontSize: 10 }}>
              <span className="warn">⚠</span> link rows live in <span className="mono">trade_decision_links</span>. Many-to-many: one decision can cover many fills; one fill may have multiple decision links.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
