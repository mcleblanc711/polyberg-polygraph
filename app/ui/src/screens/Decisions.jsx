import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { PROJECTS, SLEEVES } from '../constants.js'
import { Chip, Btn, CmdBtn, SectionH, IdMono, ReviewStatus, Empty } from '../components.jsx'
import { fmtPrice, fmtMoney, shortId, fmtTs } from '../constants.js'

export default function Decisions({ go, onDone }) {
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = () => {
    api.decisions()
      .then(d => {
        const list = Array.isArray(d) ? d : (d.decisions || [])
        setDecisions(list)
        if (list.length > 0 && !sel) setSel(list[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const statusKind = (s) => {
    if (s === 'RESOLVED_WIN') return 'pos'
    if (s === 'RESOLVED_LOSS') return 'neg'
    if (s === 'INVALIDATED') return 'draft'
    return 'warn'
  }

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[4] · decisions · fetch_decisions()</div>
          <div className="h-stat lg mt-1">DECISIONS</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            user-annotated trading ideas · editable · referenced fills remain immutable.
          </div>
        </div>
        <div className="row gap-2">
          <Btn kind="primary" size="sm" onClick={() => { setCreating(true); setSel(null) }}>+ NEW DECISION</Btn>
        </div>
      </div>

      <div className="two-col">
        <div className="panel two-col-pane" style={{ width: 460, minWidth: 360, flex: 'none' }}>
          <div className="panel-hd">
            <span className="h-comment">all · {decisions.length}</span>
            <span className="dim mono" style={{ fontSize: 10 }}>ordered by decision_timestamp DESC</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {decisions.map(d => (
              <div key={d.decision_id} className={'decision-row ' + (sel?.decision_id === d.decision_id && !creating ? 'active' : '')} onClick={() => { setSel(d); setCreating(false) }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="mono brand">{shortId(d.decision_id, 14)}</span>
                  <Chip kind={statusKind(d.status)}>{d.status}</Chip>
                </div>
                <div className="row mt-1 gap-2" style={{ fontSize: 11, flexWrap: 'wrap' }}>
                  <Chip>{d.project}</Chip>
                  <span className="mono dim" style={{ fontSize: 10 }}>· {d.sleeve}</span>
                  <span className="mono">{d.side} {d.outcome} @ {fmtPrice(d.price_used)}</span>
                </div>
                <div className="mono mt-1" style={{ fontSize: 11, color: 'var(--text-1)' }}>
                  {(d.market_title || '').slice(0, 80)}{(d.market_title || '').length > 80 ? '…' : ''}
                </div>
                <div className="row mt-2" style={{ justifyContent: 'space-between', fontSize: 10 }}>
                  <span className="dim">{d.linked_trade_count ?? 0} fills · {d.attribution_count ?? 0} attr</span>
                  {d.pnl != null && <span className={d.pnl < 0 ? 'neg' : 'pos'} style={{ fontFamily: 'var(--font-mono)' }}>{fmtMoney(d.pnl)}</span>}
                </div>
              </div>
            ))}
            {!loading && decisions.length === 0 && <Empty title="no decisions yet" hint="create the first one" />}
          </div>
        </div>

        <div className="panel two-col-pane">
          {creating
            ? <CreateDecisionForm onCancel={() => setCreating(false)} onCreate={() => { setCreating(false); load(); onDone?.() }} go={go} />
            : sel
              ? <DecisionDetail d={sel} go={go} onUpdate={load} />
              : <Empty title="select a decision" hint="or create a new one" />
          }
        </div>
      </div>
    </div>
  )
}

function DecisionDetail({ d, go, onUpdate }) {
  const [fills, setFills] = useState([])
  const [attrs, setAttrs] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.decisionTrades(d.decision_id).then(r => setFills(Array.isArray(r) ? r : (r.trades || []))).catch(() => {})
    api.attributionsByDecision(d.decision_id).then(r => setAttrs(Array.isArray(r) ? r : (r.attributions || []))).catch(() => {})
  }, [d.decision_id])

  const statusKind = (s) => {
    if (s === 'RESOLVED_WIN') return 'pos'
    if (s === 'RESOLVED_LOSS') return 'neg'
    if (s === 'INVALIDATED') return 'draft'
    return 'warn'
  }

  const startEdit = () => {
    setForm({
      thesis_summary: d.thesis_summary || '',
      rule_summary: d.rule_summary || '',
      catalyst: d.catalyst || '',
      invalidation: d.invalidation || '',
      user_notes: d.user_notes || '',
      status: d.status || 'DRAFT',
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await api.editDecision(d.decision_id, form)
      setEditing(false)
      onUpdate?.()
    } catch (e) {
      // show inline
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: 20 }} className="col gap-4">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col">
          <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
            <span className="mono brand">{shortId(d.decision_id, 16)}</span>
            <Chip>{d.project}</Chip>
            <span className="mono dim" style={{ fontSize: 10 }}>sleeve: {d.sleeve}</span>
            <Chip kind={statusKind(d.status)}>{d.status}</Chip>
          </div>
          <div className="h-stat mt-2">
            <span className={d.side === 'BUY' ? 'pos' : 'neg'}>{d.side}</span>{' '}
            <span style={{ color: 'var(--text-1)' }}>{d.outcome}</span>
            <span className="dim" style={{ fontSize: 18, marginLeft: 8 }}>@</span>
            <span className="mono" style={{ fontSize: 24, marginLeft: 6 }}>{fmtPrice(d.price_used)}</span>
          </div>
          <div className="mono mt-2" style={{ fontSize: 12 }}>{d.market_title}</div>
          <div className="dim mono mt-1" style={{ fontSize: 10 }}>{d.market_slug}</div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end' }}>
          {d.pnl != null
            ? (<>
                <div className="h-caps">post-mortem p&l</div>
                <div className={'h-stat ' + (d.pnl < 0 ? 'neg' : 'pos')}>{fmtMoney(d.pnl)}</div>
              </>)
            : (<>
                <div className="h-caps">status</div>
                <div className="dim mono">no post-mortem yet</div>
              </>)
          }
          <div className="row gap-2 mt-3">
            <Btn size="sm" onClick={editing ? saveEdit : startEdit} disabled={saving}>
              {editing ? (saving ? 'SAVING…' : '✓ SAVE') : 'EDIT'}
            </Btn>
            {editing && <Btn kind="ghost" size="sm" onClick={() => setEditing(false)}>CANCEL</Btn>}
            <Btn kind="secondary" size="sm" onClick={() => go('postmortems')}>{d.pnl != null ? 'VIEW PM' : '+ POST-MORTEM'}</Btn>
            <Btn kind="ghost" size="sm" onClick={() => go('packets')}>EXPORT PACKET</Btn>
          </div>
        </div>
      </div>

      <div className="div-dashed" />

      <div className="grid-2">
        <ReadField k="intent" v={d.intent} />
        <ReadField k="decision_type" v={d.decision_type} />
        <ReadField k="target_entry" v={d.target_entry} />
        <ReadField k="target_exit" v={d.target_exit} />
        <ReadField k="max_allocation" v={d.max_allocation != null ? `${(d.max_allocation * 100).toFixed(0)}% NAV` : '—'} />
        <ReadField k="decision_timestamp" v={d.decision_timestamp} mono />
      </div>

      {editing ? (
        <div className="grid-2">
          {[
            ['thesis_summary', 'thesis_summary', 3],
            ['rule_summary', 'rule_summary', 2],
            ['catalyst', 'catalyst', 1],
            ['invalidation', 'invalidation', 1],
          ].map(([field, label, rows]) => (
            <div key={field} className="editable-block p-3">
              <div className="h-comment mb-2" style={field === 'invalidation' ? { color: 'var(--amber)' } : undefined}>{label}</div>
              {rows > 1
                ? <textarea className="in" rows={rows} value={form[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                : <input className="in" value={form[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
              }
            </div>
          ))}
        </div>
      ) : (
        <div className="grid-2">
          {[
            ['thesis_summary', d.thesis_summary, false],
            ['rule_summary', d.rule_summary, false],
            ['catalyst', d.catalyst, false],
            ['invalidation', d.invalidation, true],
          ].map(([label, text, amber]) => (
            <div key={label} className="editable-block p-3">
              <div className="h-comment mb-2" style={amber ? { color: 'var(--amber)' } : undefined}>{label}</div>
              <div className="sans" style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-0)' }}>{text || '—'}</div>
            </div>
          ))}
        </div>
      )}

      {d.user_notes && (
        <div className="editable-block p-3">
          <div className="h-comment mb-2">user_notes</div>
          <div className="sans" style={{ fontSize: 13, lineHeight: 1.6 }}>{d.user_notes}</div>
        </div>
      )}

      <SectionH right={<CmdBtn onClick={() => go('attribution')}>review</CmdBtn>}>assistant_attributions · WHERE decision_id = ? · {attrs.length}</SectionH>
      <div className="raw-block">
        <table className="tbl" style={{ background: 'transparent' }}>
          <thead><tr><th>assistant</th><th>attribution</th><th className="num">match_q</th><th>review_status</th><th>evidence_source</th></tr></thead>
          <tbody>
            {attrs.map(a => (
              <tr key={a.attribution_id}>
                <td><span className="mono brand">{a.assistant}</span></td>
                <td><span className="mono">{a.attribution}</span></td>
                <td className="num mono">{((a.match_quality || 0) * 100).toFixed(0)}%</td>
                <td><ReviewStatus status={a.review_status} /></td>
                <td className="mono dim" style={{ fontSize: 10, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.evidence_source || '—'}</td>
              </tr>
            ))}
            {attrs.length === 0 && <tr><td colSpan="5" className="dim" style={{ padding: 12 }}>no attributions yet — export a review packet to seed them.</td></tr>}
          </tbody>
        </table>
      </div>

      <SectionH right={<CmdBtn onClick={() => go('ledger')}>open ledger</CmdBtn>}>linked fills · trade_decision_links · {fills.length}</SectionH>
      <div className="raw-block">
        <table className="tbl" style={{ background: 'transparent' }}>
          <thead><tr><th>trade_id</th><th>ts</th><th>side</th><th>out</th><th className="num">px</th><th className="num">shares</th><th className="num">notional</th></tr></thead>
          <tbody>
            {fills.map(t => (
              <tr key={t.trade_id}>
                <td><IdMono id={t.trade_id} /></td>
                <td className="id mono">{String(t.timestamp).replace('T', ' ').replace('Z', '')}</td>
                <td><span className={t.side === 'BUY' ? 'pos' : 'neg'}>{t.side}</span></td>
                <td>{t.outcome}</td>
                <td className="num mono">{fmtPrice(t.price)}</td>
                <td className="num mono dim">{(+t.shares).toFixed(3)}</td>
                <td className="num mono">{fmtMoney(t.notional)}</td>
              </tr>
            ))}
            {fills.length === 0 && <tr><td colSpan="7" className="dim" style={{ padding: 12 }}>no linked fills — visit the Unlinked Trades queue.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReadField({ k, v, mono }) {
  return (
    <div className="raw-block p-3" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="h-caps">{k}</span>
      <span className={mono ? 'mono' : ''} style={{ fontSize: 13, color: 'var(--text-0)' }}>{v || '—'}</span>
    </div>
  )
}

function CreateDecisionForm({ onCancel, onCreate, go }) {
  const [form, setForm] = useState({
    project: 'EXPERIMENTAL', sleeve: 'main', market_slug: '', market_title: '',
    outcome: 'Yes', side: 'BUY', intent: 'OPEN_POSITION', decision_type: 'RULE_FOLLOW',
    price_used: 0.5, max_allocation: 0.05, target_entry: '', target_exit: '',
    thesis_summary: '', rule_summary: '', catalyst: '', invalidation: '', user_notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.createDecision(form)
      onCreate?.()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: 20 }} className="col gap-3">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="h-stat sm">+ NEW DECISION</div>
        <Btn kind="ghost" size="sm" onClick={onCancel}>✕ CANCEL</Btn>
      </div>
      <div className="dim mono" style={{ fontSize: 11 }}>maps to create_decision(conn, **fields)</div>

      {error && <div className="neg mono" style={{ fontSize: 11 }}>⚠ {error}</div>}

      <div className="grid-2" style={{ gap: 12 }}>
        <div className="col">
          <label className="in-label">project · enum</label>
          <select className="in" value={form.project} onChange={e => set('project', e.target.value)}>
            {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="col">
          <label className="in-label">sleeve</label>
          <select className="in" value={form.sleeve} onChange={e => set('sleeve', e.target.value)}>
            {SLEEVES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col"><label className="in-label">market_slug</label><input className="in" value={form.market_slug} onChange={e => set('market_slug', e.target.value)} placeholder="e.g. fed-cuts-rates-december-2026" /></div>
        <div className="col"><label className="in-label">market_title</label><input className="in" value={form.market_title} onChange={e => set('market_title', e.target.value)} placeholder="human-readable title" /></div>
        <div className="col">
          <label className="in-label">outcome</label>
          <select className="in" value={form.outcome} onChange={e => set('outcome', e.target.value)}>
            <option>Yes</option><option>No</option>
          </select>
        </div>
        <div className="col">
          <label className="in-label">side</label>
          <select className="in" value={form.side} onChange={e => set('side', e.target.value)}>
            <option>BUY</option><option>SELL</option>
          </select>
        </div>
        <div className="col">
          <label className="in-label">intent</label>
          <select className="in" value={form.intent} onChange={e => set('intent', e.target.value)}>
            {['OPEN_POSITION','ADD','REDUCE','CLOSE','MARKET_MAKE'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="col">
          <label className="in-label">decision_type</label>
          <select className="in" value={form.decision_type} onChange={e => set('decision_type', e.target.value)}>
            {['RULE_FOLLOW','MODEL_EDGE','SPREAD_CAPTURE','READ_ON_PROCEDURE','EXPERIMENTAL'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="col"><label className="in-label">price_used · 0–1</label><input className="in" type="number" min="0" max="1" step="0.001" value={form.price_used} onChange={e => set('price_used', +e.target.value)} /></div>
        <div className="col"><label className="in-label">max_allocation · 0–1</label><input className="in" type="number" min="0" max="1" step="0.01" value={form.max_allocation} onChange={e => set('max_allocation', +e.target.value)} /></div>
        <div className="col"><label className="in-label">target_entry</label><input className="in" value={form.target_entry} onChange={e => set('target_entry', e.target.value)} placeholder="0.36–0.40" /></div>
        <div className="col"><label className="in-label">target_exit</label><input className="in" value={form.target_exit} onChange={e => set('target_exit', e.target.value)} placeholder="0.65 or resolution" /></div>
      </div>

      <div className="col"><label className="in-label">thesis_summary</label><textarea className="in" rows="3" value={form.thesis_summary} onChange={e => set('thesis_summary', e.target.value)} placeholder="why is this trade right? what's the edge?" /></div>
      <div className="col"><label className="in-label">rule_summary</label><textarea className="in" rows="2" value={form.rule_summary} onChange={e => set('rule_summary', e.target.value)} placeholder="which playbook rule does this fall under?" /></div>
      <div className="col"><label className="in-label">catalyst</label><input className="in" value={form.catalyst} onChange={e => set('catalyst', e.target.value)} placeholder="next scheduled event that should move this" /></div>
      <div className="col"><label className="in-label">invalidation</label><input className="in" value={form.invalidation} onChange={e => set('invalidation', e.target.value)} placeholder="what would force you out?" /></div>
      <div className="col"><label className="in-label">user_notes</label><textarea className="in" rows="2" value={form.user_notes} onChange={e => set('user_notes', e.target.value)} /></div>

      <div className="row gap-2 mt-2">
        <Btn kind="primary" onClick={submit} disabled={saving}>▶ CREATE</Btn>
        <Btn kind="ghost" onClick={onCancel}>CANCEL</Btn>
        <span className="dim mono" style={{ fontSize: 10, alignSelf: 'center' }}>status defaults to DRAFT</span>
      </div>
    </div>
  )
}
