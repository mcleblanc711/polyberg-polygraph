import { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { ASSISTANTS, ATTRIBUTIONS, REVIEW_STATUSES } from '../constants.js'
import { Chip, Btn, CmdBtn, ReviewStatus, Empty } from '../components.jsx'
import { fmtPrice, fmtMoney, shortId } from '../constants.js'

export default function Attribution({ go, onDone }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAssistant, setFilterAssistant] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterAttr, setFilterAttr] = useState('ALL')
  const [pivot, setPivot] = useState('ALL')
  const [sel, setSel] = useState(null)

  const load = () => {
    api.attributions()
      .then(d => {
        const list = Array.isArray(d) ? d : (d.attributions || [])
        setRows(list)
        if (list.length > 0 && !sel) setSel(list[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => rows.filter(a => {
    if (filterAssistant !== 'ALL' && a.assistant !== filterAssistant) return false
    if (filterStatus !== 'ALL' && a.review_status !== filterStatus) return false
    if (filterAttr !== 'ALL' && a.attribution !== filterAttr) return false
    if (pivot === 'TRADE' && !a.trade_id) return false
    if (pivot === 'DECISION' && !a.decision_id) return false
    return true
  }), [rows, filterAssistant, filterStatus, filterAttr, pivot])

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[5] · assistant attribution · add_assistant_attribution</div>
          <div className="h-stat lg mt-1">ASSISTANT ATTRIBUTION</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            one row per (subject · assistant) — {ASSISTANTS.join(' · ')}. subject = trade_id OR decision_id. Annotation only — never mutates fills.
          </div>
        </div>
      </div>

      <div className="three-col">
        <div className="panel three-col-pane" style={{ width: 380, minWidth: 380, maxWidth: 380, flex: 'none' }}>
          <div className="panel-hd">
            <span className="h-comment">attributions · {filtered.length}</span>
          </div>

          <div style={{ padding: 12, borderBottom: '1px solid var(--border-1)' }} className="col gap-2">
            <div className="row gap-2">
              {['ALL', 'TRADE', 'DECISION'].map(p => (
                <button key={p} className={'target-pick ' + (pivot === p ? 'active' : '')} style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => setPivot(p)}>{p}</button>
              ))}
            </div>
            <select className="in" value={filterAssistant} onChange={e => setFilterAssistant(e.target.value)}>
              <option value="ALL">all assistants</option>
              {ASSISTANTS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className="in" value={filterAttr} onChange={e => setFilterAttr(e.target.value)}>
              <option value="ALL">any attribution value</option>
              {ATTRIBUTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className="in" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="ALL">any review status</option>
              {REVIEW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map(a => (
              <div key={a.attribution_id} className={'q-row ' + (sel?.attribution_id === a.attribution_id ? 'active' : '')} onClick={() => setSel(a)}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="mono brand" style={{ fontSize: 10 }}>{shortId(a.attribution_id, 9)}</span>
                  <ReviewStatus status={a.review_status} />
                </div>
                <div className="row gap-2 mt-1" style={{ fontSize: 11 }}>
                  <Chip kind={a.assistant === 'GPT' ? 'gpt' : a.assistant === 'CLAUDE' ? 'claude' : 'draft'}>{a.assistant}</Chip>
                  <span className="mono" style={{ fontSize: 10 }}>{a.attribution}</span>
                </div>
                <div className="mt-1 mono dim" style={{ fontSize: 10 }}>
                  {a.trade_id && <>trd: {shortId(a.trade_id, 7)}</>}
                  {a.decision_id && <>dec: {shortId(a.decision_id, 10)}</>}
                </div>
                <div className="row mt-1" style={{ justifyContent: 'space-between', fontSize: 10 }}>
                  <span className="dim mono">match_q</span>
                  <span className="mono brand">{((a.match_quality || 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
            {!loading && filtered.length === 0 && <Empty title="no attributions match" hint="loosen filters or import a transcript" />}
          </div>
        </div>

        <div className="three-col-pane col" style={{ overflowY: 'auto', gap: 16, padding: 16, flex: 1, minWidth: 0 }}>
          {sel
            ? <AttributionEditor a={sel} go={go} onUpdate={() => { load(); onDone?.() }} />
            : <Empty title="select an attribution" />
          }
        </div>

        <div className="three-col-pane col" style={{ gap: 16, overflowY: 'auto', padding: 16, maxWidth: 360, flex: 'none' }}>
          <div className="panel p-3">
            <div className="h-comment mb-3">attribution vocabulary · enums.ATTRIBUTIONS</div>
            <div className="col gap-3">
              {[
                ['DIRECT_RECOMMENDATION', 'Assistant explicitly told you to make this trade.'],
                ['SUPPORTED_AFTER_REVIEW', 'You proposed; assistant reviewed and supported.'],
                ['OPPOSED', 'Assistant argued against this trade.'],
                ['MENTIONED_BUT_NOT_RECOMMENDED', 'Came up in conversation; no actual recommendation.'],
                ['NO_MATCH_FOUND', 'Conversations searched — no matching recommendation exists.'],
                ['NOT_INVOLVED', 'Assistant was not part of this decision flow at all.'],
                ['UNCLEAR', 'Conversation is ambiguous; needs another pass.'],
              ].map(([k, desc]) => (
                <div key={k} className="col gap-1">
                  <span className="mono" style={{ fontSize: 10, letterSpacing: '0.06em', color: 'var(--text-0)' }}>{k}</span>
                  <div className="dim" style={{ fontSize: 11, lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-3" style={{ borderColor: 'var(--amber)' }}>
            <div className="h-comment mb-2" style={{ color: 'var(--amber)' }}>critical distinction</div>
            <div className="col gap-3" style={{ fontSize: 12, lineHeight: 1.6 }}>
              <div><Chip kind="draft">NO_MATCH_FOUND</Chip><div className="dim mt-1">= you opened the assistant's history, searched, and found nothing relevant.</div></div>
              <div><Chip kind="draft">NOT_INVOLVED</Chip><div className="dim mt-1">= assistant was never part of this trade's reasoning loop.</div></div>
              <div className="dim" style={{ fontSize: 11, borderTop: '1px dashed var(--border-1)', paddingTop: 8 }}>downstream analytics count these very differently.</div>
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
            <div className="dim mt-3" style={{ fontSize: 10 }}>mark_attribution_review_status(conn, attribution_id, review_status)</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AttributionEditor({ a, go, onUpdate }) {
  const [attr, setAttr] = useState(a.attribution)
  const [matchQ, setMatchQ] = useState(Math.round((a.match_quality || 0) * 100))
  const [status, setStatus] = useState(a.review_status)
  const [evidence, setEvidence] = useState(a.evidence || '')
  const [evidenceSource, setEvidenceSource] = useState(a.evidence_source || '')
  const [recPrice, setRecPrice] = useState(a.recommended_price ?? '')
  const [recSize, setRecSize] = useState(a.recommended_size ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setAttr(a.attribution)
    setMatchQ(Math.round((a.match_quality || 0) * 100))
    setStatus(a.review_status)
    setEvidence(a.evidence || '')
    setEvidenceSource(a.evidence_source || '')
    setRecPrice(a.recommended_price ?? '')
    setRecSize(a.recommended_size ?? '')
  }, [a.attribution_id])

  const updateStatus = async (newStatus) => {
    setSaving(true)
    try {
      await api.updateReviewStatus(a.attribution_id, newStatus)
      setStatus(newStatus)
      onUpdate?.()
    } catch (e) {} finally { setSaving(false) }
  }

  const confirm = () => updateStatus('USER_CONFIRMED')
  const reject = () => updateStatus('REJECTED')
  const saveDraft = () => updateStatus('DRAFT')

  const accentColor = a.assistant === 'GPT' ? 'var(--gpt)' : a.assistant === 'CLAUDE' ? 'var(--claude)' : 'var(--magenta)'

  return (
    <div className="col gap-4">
      <div className="panel p-3">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="h-comment">subject</span>
          <Chip kind={a.assistant === 'GPT' ? 'gpt' : a.assistant === 'CLAUDE' ? 'claude' : 'draft'}>{a.assistant}</Chip>
        </div>
        <div className="mt-2 col gap-1">
          {a.decision_id && (
            <>
              <div className="row gap-2">
                <span className="mono brand">{shortId(a.decision_id, 14)}</span>
              </div>
              <Btn kind="ghost" size="sm" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={() => go('decisions')}>→ open decision</Btn>
            </>
          )}
          {a.trade_id && (
            <>
              <div className="row gap-2">
                <span className="mono brand">{shortId(a.trade_id, 12)}</span>
              </div>
              <Btn kind="ghost" size="sm" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={() => go('ledger')}>→ open trade</Btn>
            </>
          )}
        </div>
      </div>

      <div className="panel" style={{ borderLeft: `3px solid ${accentColor}` }}>
        <div className="panel-hd">
          <div className="row gap-2">
            <span className="h-caps" style={{ color: accentColor }}>{a.assistant} attribution</span>
            <span className="mono dim" style={{ fontSize: 10 }}>{shortId(a.attribution_id, 12)}</span>
          </div>
          <ReviewStatus status={status} />
        </div>
        <div style={{ padding: 14 }} className="col gap-3">
          <div className="attr-grid">
            {ATTRIBUTIONS.map(v => (
              <button key={v} className={'attr-pick ' + (attr === v ? 'active' : '')} onClick={() => setAttr(v)}>{v}</button>
            ))}
          </div>

          <div className="col">
            <label className="in-label">review_status</label>
            <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
              {REVIEW_STATUSES.map(s => (
                <button key={s} className={'status-pick ' + (status === s ? 'active' : '')} onClick={() => setStatus(s)}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel p-3 col gap-3">
        <div className="h-comment">evidence + numeric tells</div>

        <div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <label className="in-label">match_quality · 0.00 → 1.00</label>
            <span className="mono tnum brand" style={{ fontSize: 13 }}>{(matchQ / 100).toFixed(2)}</span>
          </div>
          <input type="range" min="0" max="100" value={matchQ} onChange={e => setMatchQ(+e.target.value)} style={{ width: '100%', accentColor: 'var(--magenta)' }} />
          <div className="dim mt-1" style={{ fontSize: 10 }}>
            transcript-sourced rows land at 0.4–0.9 with status NEEDS_REVIEW. NO_MATCH_FOUND and NOT_INVOLVED both use match_quality = 1.0.
          </div>
        </div>

        <div className="grid-2" style={{ gap: 12 }}>
          <div className="col">
            <label className="in-label">recommended_price · 0–1</label>
            <input className="in" type="number" min="0" max="1" step="0.01" value={recPrice} onChange={e => setRecPrice(e.target.value)} placeholder="—" />
          </div>
          <div className="col">
            <label className="in-label">recommended_size · 0–1 (NAV)</label>
            <input className="in" type="number" min="0" step="0.01" value={recSize} onChange={e => setRecSize(e.target.value)} placeholder="—" />
          </div>
        </div>

        <div className="col">
          <label className="in-label">evidence_source · file path, URL, or transcript anchor</label>
          <input className="in" value={evidenceSource} onChange={e => setEvidenceSource(e.target.value)} placeholder="chat_2026-05-22_oil_hormuz.md#L41-L82" />
        </div>

        <div className="col">
          <label className="in-label">evidence · quote or notes</label>
          <textarea className="in" rows="3" value={evidence} onChange={e => setEvidence(e.target.value)} placeholder='> "..." — verbatim if possible' />
        </div>

        <div className="row gap-2 mt-1">
          <Btn kind="primary" onClick={confirm} disabled={saving}>✓ CONFIRM</Btn>
          <Btn kind="danger" size="sm" onClick={reject} disabled={saving}>✕ REJECT</Btn>
          <Btn kind="ghost" size="sm" onClick={saveDraft} disabled={saving}>SAVE DRAFT</Btn>
          <span className="dim mono" style={{ fontSize: 10, marginLeft: 'auto', alignSelf: 'center' }}>persists via mark_attribution_review_status</span>
        </div>
      </div>
    </div>
  )
}
