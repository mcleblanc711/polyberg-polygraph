import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { QUALITY_VALUES, REASON_GROUPS } from '../constants.js'
import { Chip, Btn, CmdBtn, Empty } from '../components.jsx'
import { fmtPrice, fmtMoney, shortId } from '../constants.js'

export default function PostMortems({ go, onDone }) {
  const [decisions, setDecisions] = useState([])
  const [postmortems, setPostmortems] = useState([])
  const [tab, setTab] = useState('PENDING')
  const [sel, setSel] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    Promise.all([api.decisions(), api.postmortems()])
      .then(([d, p]) => {
        const decs = Array.isArray(d) ? d : (d.decisions || [])
        const pms = Array.isArray(p) ? p : (p.postmortems || [])
        setDecisions(decs)
        setPostmortems(pms)
        if (!sel && decs.length > 0) {
          const resolved = decs.filter(x => ['RESOLVED_WIN','RESOLVED_LOSS','INVALIDATED'].includes(x.status))
          if (resolved.length > 0) setSel(resolved[0])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const resolved = decisions.filter(d => ['RESOLVED_WIN','RESOLVED_LOSS','INVALIDATED'].includes(d.status))
  const pmByDecision = Object.fromEntries(postmortems.map(p => [p.decision_id, p]))
  const pending = resolved.filter(d => !pmByDecision[d.decision_id])
  const done = postmortems.map(p => ({ pm: p, dec: decisions.find(d => d.decision_id === p.decision_id) })).filter(x => x.dec)

  const statusKind = (s) => s === 'RESOLVED_WIN' ? 'pos' : s === 'INVALIDATED' ? 'draft' : 'neg'

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[6] · post-mortems · create_or_update_postmortem()</div>
          <div className="h-stat lg mt-1">POST-MORTEMS</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            forensic review · separate process quality from outcome luck · error code from REASON_ERROR_CODES (26)
          </div>
        </div>
      </div>

      <div className="tabs" style={{ paddingLeft: 24, flexShrink: 0 }}>
        <div className={'tab ' + (tab === 'PENDING' ? 'active' : '')} onClick={() => setTab('PENDING')}>pending ({pending.length})</div>
        <div className={'tab ' + (tab === 'DONE' ? 'active' : '')} onClick={() => setTab('DONE')}>completed ({done.length})</div>
        <div className={'tab ' + (tab === 'EDITOR' ? 'active' : '')} onClick={() => setTab('EDITOR')}>editor</div>
      </div>

      {tab === 'PENDING' && (
        <div className="screen-body">
          <div className="col gap-3" style={{ padding: 20 }}>
            {pending.length === 0 && <Empty title="queue clear ✓" hint="all resolved decisions are written up" />}
            {pending.map(d => (
              <div key={d.decision_id} className="editable-block p-4">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row gap-2">
                    <span className="mono brand">{shortId(d.decision_id, 14)}</span>
                    <Chip>{d.project}</Chip>
                    <Chip kind="warn">{d.status} · NEEDS PM</Chip>
                  </div>
                  <Btn kind="primary" size="sm" onClick={() => { setSel(d); setTab('EDITOR') }}>▶ WRITE POST-MORTEM</Btn>
                </div>
                <div className="row mt-2 gap-3" style={{ fontSize: 12 }}>
                  <span className="mono">{d.side} {d.outcome} @ {fmtPrice(d.price_used)}</span>
                  <span className="dim">·</span>
                  <span className="dim mono">{d.market_title}</span>
                </div>
                {d.thesis_summary && <div className="dim mt-2 sans" style={{ fontSize: 12 }}>{d.thesis_summary.slice(0, 200)}…</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'DONE' && (
        <div className="screen-body">
          <div className="col gap-3" style={{ padding: 20 }}>
            {done.map(({ pm, dec }) => (
              <div key={pm.postmortem_id} className="panel p-4" style={{ cursor: 'pointer' }} onClick={() => { setSel(dec); setTab('EDITOR') }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row gap-2">
                    <span className="mono brand">{shortId(dec.decision_id, 14)}</span>
                    <Chip>{dec.project}</Chip>
                    <Chip kind={pm.pnl >= 0 ? 'pos' : 'neg'}>{dec.status}</Chip>
                  </div>
                  <span className={'mono ' + (pm.pnl < 0 ? 'neg' : 'pos')}>{fmtMoney(pm.pnl)}</span>
                </div>
                <div className="row mt-2 gap-2" style={{ fontSize: 11, flexWrap: 'wrap' }}>
                  <QualityChip k="thesis" v={pm.thesis_quality} />
                  <QualityChip k="execution" v={pm.execution_quality} />
                  <QualityChip k="sizing" v={pm.sizing_quality} />
                  <QualityChip k="exit" v={pm.exit_quality} />
                  <QualityChip k="rule" v={pm.rule_read_quality} />
                  {pm.primary_error_type && <span className="evidence-tag">{pm.primary_error_type}</span>}
                  {pm.secondary_error_type && <span className="evidence-tag" style={{ opacity: 0.7 }}>{pm.secondary_error_type}</span>}
                </div>
              </div>
            ))}
            {done.length === 0 && <Empty title="no completed post-mortems" />}
          </div>
        </div>
      )}

      {tab === 'EDITOR' && (
        sel
          ? <PostMortemEditor d={sel} existing={pmByDecision[sel.decision_id]} go={go} onSave={() => { load(); onDone?.() }} />
          : (
            <div className="screen-body" style={{ padding: 20 }}>
              <Empty title="select a decision from Pending or Completed" hint="or click a decision in the Pending tab" />
            </div>
          )
      )}
    </div>
  )
}

function QualityChip({ k, v }) {
  if (!v) return <span className="dim mono" style={{ fontSize: 10 }}>{k}: —</span>
  const tone = v === 'EXCELLENT' || v === 'GOOD' ? 'pos' : v === 'OK' ? 'draft' : 'warn'
  return <span className={'chip chip-' + tone} title={`${k}_quality = ${v}`}><span className="dim mono">{k}:</span>&nbsp;{v}</span>
}

function PostMortemEditor({ d, existing, go, onSave }) {
  const [pnl, setPnl] = useState(existing?.pnl ?? 0)
  const [thesisQ, setThesisQ] = useState(existing?.thesis_quality ?? 'GOOD')
  const [execQ, setExecQ] = useState(existing?.execution_quality ?? 'GOOD')
  const [sizeQ, setSizeQ] = useState(existing?.sizing_quality ?? 'OK')
  const [exitQ, setExitQ] = useState(existing?.exit_quality ?? 'GOOD')
  const [ruleQ, setRuleQ] = useState(existing?.rule_read_quality ?? 'GOOD')
  const [primaryErr, setPrimaryErr] = useState(existing?.primary_error_type ?? '')
  const [secondaryErr, setSecondaryErr] = useState(existing?.secondary_error_type ?? '')
  const [whatRight, setWhatRight] = useState(existing?.what_went_right ?? '')
  const [whatWrong, setWhatWrong] = useState(existing?.what_went_wrong ?? '')
  const [lessonKeep, setLessonKeep] = useState(existing?.lesson_keep ?? '')
  const [lessonChange, setLessonChange] = useState(existing?.lesson_change ?? '')
  const [neverRepeat, setNeverRepeat] = useState(existing?.never_repeat ?? '')
  const [futureRule, setFutureRule] = useState(existing?.future_rule ?? '')
  const [errorPickerSlot, setErrorPickerSlot] = useState('primary')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const pickError = (code) => {
    if (errorPickerSlot === 'primary') setPrimaryErr(code)
    else setSecondaryErr(code)
  }

  const markdown = buildPmMarkdown({ d, pnl, thesisQ, execQ, sizeQ, exitQ, ruleQ, primaryErr, secondaryErr, whatRight, whatWrong, lessonKeep, lessonChange, neverRepeat, futureRule })

  const save = async () => {
    setSaving(true)
    try {
      await api.upsertPostmortem(d.decision_id, { pnl, thesis_quality: thesisQ, execution_quality: execQ, sizing_quality: sizeQ, exit_quality: exitQ, rule_read_quality: ruleQ, primary_error_type: primaryErr || null, secondary_error_type: secondaryErr || null, what_went_right: whatRight, what_went_wrong: whatWrong, lesson_keep: lessonKeep, lesson_change: lessonChange, never_repeat: neverRepeat, future_rule: futureRule, markdown_body: markdown })
      onSave?.()
    } catch (e) {} finally { setSaving(false) }
  }

  return (
    <div className="pm-editor">
      <div className="pm-pane" style={{ overflowY: 'auto' }}>
        <div className="p-4 col gap-4">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row gap-2">
              <span className="mono brand">{shortId(d.decision_id, 14)}</span>
              <Chip>{d.project}</Chip>
              <Chip kind={d.status === 'RESOLVED_WIN' ? 'pos' : d.status === 'INVALIDATED' ? 'draft' : 'neg'}>{d.status}</Chip>
              {existing && <Chip kind="confirmed">SAVED · {shortId(existing.postmortem_id, 9)}</Chip>}
            </div>
            <div className="row gap-2">
              <Btn kind="ghost" size="sm" onClick={save} disabled={saving}>{saving ? 'SAVING…' : 'SAVE'}</Btn>
              <Btn kind="secondary" size="sm" onClick={() => go('packets')}>EXPORT PACKET</Btn>
              <Btn kind="primary" size="sm" onClick={save} disabled={saving}>✓ COMMIT</Btn>
            </div>
          </div>

          <PMSection title="decision · raw context" raw>
            <table className="tbl">
              <tbody>
                <tr><td className="dim">market</td><td className="mono">{d.market_title}</td></tr>
                <tr><td className="dim">market_slug</td><td className="mono dim">{d.market_slug}</td></tr>
                <tr><td className="dim">side / outcome</td><td className="mono">{d.side} · {d.outcome}</td></tr>
                <tr><td className="dim">price_used</td><td className="mono">{fmtPrice(d.price_used)}</td></tr>
                <tr><td className="dim">project / sleeve</td><td className="mono">{d.project} / {d.sleeve}</td></tr>
              </tbody>
            </table>
          </PMSection>

          <PMSection title="original thesis_summary" raw>
            <div className="sans" style={{ fontSize: 13, lineHeight: 1.7 }}>{d.thesis_summary || '—'}</div>
          </PMSection>

          <PMSection title="rule_summary + invalidation" raw>
            <div className="sans" style={{ fontSize: 13, lineHeight: 1.7 }}>{d.rule_summary || '—'}</div>
            <div className="div-dashed" />
            <div className="sans dim" style={{ fontSize: 12 }}>invalidation: {d.invalidation || '—'}</div>
          </PMSection>

          <PMSection title="pnl · REAL" editable>
            <div className="row gap-2" style={{ alignItems: 'center' }}>
              <input className="in" type="number" step="0.01" value={pnl} onChange={e => setPnl(+e.target.value)} style={{ width: 160 }} />
              <span className={'mono ' + (pnl < 0 ? 'neg' : 'pos')} style={{ fontSize: 20 }}>{fmtMoney(pnl)}</span>
            </div>
          </PMSection>

          <PMSection title="quality dimensions · TEXT" editable>
            <div className="eval-grid">
              <EvalRow label="thesis_quality" val={thesisQ} setVal={setThesisQ} />
              <EvalRow label="execution_quality" val={execQ} setVal={setExecQ} />
              <EvalRow label="sizing_quality" val={sizeQ} setVal={setSizeQ} />
              <EvalRow label="exit_quality" val={exitQ} setVal={setExitQ} />
              <EvalRow label="rule_read_quality" val={ruleQ} setVal={setRuleQ} />
            </div>
          </PMSection>

          <PMSection title="error types · REASON_ERROR_CODES (26)" editable>
            <div className="row gap-2 mb-3">
              <button className={'target-pick ' + (errorPickerSlot === 'primary' ? 'active' : '')} onClick={() => setErrorPickerSlot('primary')}>primary: {primaryErr || '—'}</button>
              <button className={'target-pick ' + (errorPickerSlot === 'secondary' ? 'active' : '')} onClick={() => setErrorPickerSlot('secondary')}>secondary: {secondaryErr || '—'}</button>
              <Btn kind="ghost" size="sm" onClick={() => (errorPickerSlot === 'primary' ? setPrimaryErr('') : setSecondaryErr(''))}>clear slot</Btn>
            </div>
            <div className="col gap-3">
              {REASON_GROUPS.map(group => (
                <div key={group.name}>
                  <div className="h-caps" style={{ marginBottom: 6 }}>{group.name}</div>
                  <div className="reason-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {group.codes.map(code => {
                      const isPrim = primaryErr === code
                      const isSec = secondaryErr === code
                      return (
                        <button
                          key={code}
                          className="attr-pick"
                          style={isPrim ? { borderColor: 'var(--magenta)', color: 'var(--magenta)', background: 'var(--magenta-soft)' } : isSec ? { borderColor: 'var(--cyan)', color: 'var(--cyan)', background: 'var(--cyan-soft)' } : undefined}
                          onClick={() => pickError(code)}
                        >
                          {code}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </PMSection>

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

      <div className="pm-pane" style={{ background: 'var(--bg-0)', borderLeft: '1px solid var(--border-1)' }}>
        <div className="panel-hd">
          <span className="h-comment">markdown_body preview</span>
          <div className="row gap-2">
            <CmdBtn onClick={() => { navigator.clipboard?.writeText(markdown).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>
              {copied ? '✓ copied' : 'copy'}
            </CmdBtn>
          </div>
        </div>
        <div className="markdown-preview">
          <pre>{markdown}</pre>
        </div>
      </div>
    </div>
  )
}

function PMSection({ title, raw, editable, children }) {
  return (
    <div className={raw ? 'raw-block p-3' : (editable ? 'editable-block p-3' : 'panel p-3')}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="h-comment">{title}</span>
        {raw && <Chip kind="immutable">FROM DECISION</Chip>}
        {editable && <span className="evidence-tag">postmortem field</span>}
      </div>
      {children}
    </div>
  )
}

function EvalRow({ label, val, setVal }) {
  return (
    <div className="eval-row">
      <span className="mono dim" style={{ fontSize: 11 }}>{label}</span>
      <div className="row gap-1">
        {QUALITY_VALUES.map(q => {
          const active = val === q
          const tone = q === 'EXCELLENT' || q === 'GOOD' ? 'var(--green)' : q === 'OK' ? 'var(--cyan)' : 'var(--amber)'
          return (
            <button
              key={q}
              onClick={() => setVal(q)}
              className="quality-pick"
              style={{
                background: active ? tone : 'transparent',
                color: active ? '#000' : 'var(--text-2)',
                borderColor: active ? tone : 'var(--border-1)',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '4px 6px',
                border: '1px solid',
                cursor: 'pointer',
              }}
            >
              {q}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function buildPmMarkdown({ d, pnl, thesisQ, execQ, sizeQ, exitQ, ruleQ, primaryErr, secondaryErr, whatRight, whatWrong, lessonKeep, lessonChange, neverRepeat, futureRule }) {
  return `# Post-mortem · ${d.decision_id}

**Project:**   ${d.project} / ${d.sleeve}
**Market:**    ${d.market_title}
**Slug:**      ${d.market_slug}
**Position:**  ${d.side} ${d.outcome} @ ${fmtPrice(d.price_used)}
**Status:**    ${d.status}
**PnL:**       ${fmtMoney(pnl)}

## Quality
| dimension          | value |
|--------------------|-------|
| thesis_quality     | ${thesisQ} |
| execution_quality  | ${execQ} |
| sizing_quality     | ${sizeQ} |
| exit_quality       | ${exitQ} |
| rule_read_quality  | ${ruleQ} |

**primary_error_type:**   ${primaryErr || '—'}
**secondary_error_type:** ${secondaryErr || '—'}

## What went right
${whatRight || '—'}

## What went wrong
${whatWrong || '—'}

## Lessons
- **keep:**         ${lessonKeep || '—'}
- **change:**       ${lessonChange || '—'}
- **never_repeat:** ${neverRepeat || '—'}

## Future rule
${futureRule || '—'}
`
}
