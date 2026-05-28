import { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { Btn, Chip } from '../components.jsx'

const DATE_RANGES = [
  { days: 30,  label: 'Last 30 days' },
  { days: 90,  label: 'Last 90 days' },
  { days: 365, label: 'Last 365 days' },
  { days: 0,   label: 'All time' },
]

export default function AttrPrompt({ go }) {
  const [daysBack, setDaysBack] = useState(30)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [tradeCount, setTradeCount] = useState(null)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const r = await api.attributionPrompt(daysBack === 0 ? 99999 : daysBack)
      setPrompt(r.prompt || r)
      setTradeCount(r.trade_count ?? null)
    } catch (e) {
      setPrompt(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const previewLines = useMemo(() => {
    const lines = prompt.split('\n')
    const truncated = lines.length > 100
    return { text: lines.slice(0, 100).join('\n') + (truncated ? '\n...' : ''), lineCount: lines.length }
  }, [prompt])

  const copy = () => {
    navigator.clipboard?.writeText(prompt).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const download = () => {
    const blob = new Blob([prompt], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'attribution_prompt.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[9] · attribution prompt · attribution_prompt.generate_attribution_prompt()</div>
          <div className="h-stat lg mt-1">ATTRIBUTION PROMPT</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            bulk trade list, fill-in-the-blank format — paste into Claude or GPT and they label each row{' '}
            <span className="mono">CLAUDE</span> · <span className="mono">GPT</span> · <span className="mono">USER</span> · <span className="mono">MIXED</span> · blank.
          </div>
        </div>
      </div>

      <div className="screen-body" style={{ padding: 24, overflowY: 'auto' }}>
        <div className="export-grid">
          <div className="panel p-4 col gap-4">
            <div className="col">
              <label className="in-label">date range</label>
              <div className="col gap-2">
                {DATE_RANGES.map(r => (
                  <button
                    key={r.days}
                    className={'big-pick ' + (daysBack === r.days ? 'active' : '')}
                    onClick={() => { setDaysBack(r.days); setPrompt('') }}
                  >
                    <div className="row" style={{ justifyContent: 'space-between' }}>
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
                <div><span className="k">days_back</span><span className="v mono">{daysBack === 0 ? 'ALL_TIME' : daysBack}</span></div>
                {tradeCount != null && <div><span className="k">trades in window</span><span className="v mono">{tradeCount}</span></div>}
                <div><span className="k">sorted</span><span className="v mono dim">newest-first, grouped by UTC date</span></div>
              </div>
            </div>

            <div className="div-dashed" />

            <div className="col gap-2">
              <Btn kind="primary" onClick={generate} disabled={loading}>
                {loading ? '⏳ GENERATING…' : '▶ GENERATE PROMPT'}
              </Btn>
              <Btn disabled={!prompt} onClick={download}>⌄ DOWNLOAD attribution_prompt.txt</Btn>
              <Btn kind="ghost" disabled={!prompt} onClick={copy}>⌗ {copied ? '✓ COPIED' : 'COPY ALL'}</Btn>
            </div>

            <div className="panel p-3" style={{ borderLeft: '3px solid var(--amber)' }}>
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

          <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-hd">
              <span className="h-comment">prompt · preview (first 100 lines)</span>
              {prompt && (
                <span className="mono dim" style={{ fontSize: 10 }}>
                  {prompt.length.toLocaleString()} chars · {previewLines.lineCount} lines
                </span>
              )}
            </div>
            {!prompt
              ? <div className="dim" style={{ padding: 24, fontSize: 12 }}>click ▶ GENERATE PROMPT to build the attribution sweep.</div>
              : (
                <div className="markdown-preview" style={{ flex: 1, padding: 16 }}>
                  <pre>{previewLines.text}</pre>
                </div>
              )
            }
          </div>
        </div>

        <div className="panel" style={{ marginTop: 24 }}>
          <div className="panel-hd">
            <span className="h-comment">reply key · how the assistant returns labels</span>
          </div>
          <div className="grid-2" style={{ padding: 16, gap: 16 }}>
            <div className="col gap-2">
              <div className="row gap-2"><Chip kind="claude">CLAUDE</Chip><span className="dim" style={{ fontSize: 12 }}>this assistant recognised the trade from our chats</span></div>
              <div className="row gap-2"><Chip kind="gpt">GPT</Chip><span className="dim" style={{ fontSize: 12 }}>other assistant influenced this</span></div>
              <div className="row gap-2"><Chip kind="draft">USER</Chip><span className="dim" style={{ fontSize: 12 }}>your own call · no LLM involved</span></div>
              <div className="row gap-2"><Chip kind="warn">MIXED</Chip><span className="dim" style={{ fontSize: 12 }}>both assistants in the loop</span></div>
              <div className="row gap-2"><span className="mono dim" style={{ width: 64, textAlign: 'center' }}>(blank)</span><span className="dim" style={{ fontSize: 12 }}>not recognised</span></div>
            </div>
            <div className="dim sans" style={{ fontSize: 12, lineHeight: 1.6 }}>
              Pair this prompt with <span className="mono">prompts/attribution_prompt.md</span> in the repo — that's the system message the operator pastes alongside this trade list.
              The assistant must answer using only packet context and may not recommend new trades, orders, entries, exits, or live market action.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
