import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { Btn } from '../components.jsx'
import { shortId, fmtPrice } from '../constants.js'

export default function Packets({ go }) {
  const [type, setType] = useState('ATTRIBUTION')
  const [trades, setTrades] = useState([])
  const [decisions, setDecisions] = useState([])
  const [tradeId, setTradeId] = useState('')
  const [decId, setDecId] = useState('')
  const [packet, setPacket] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Promise.all([api.trades(), api.decisions()]).then(([t, d]) => {
      const tlist = Array.isArray(t) ? t : (t.trades || [])
      const dlist = Array.isArray(d) ? d : (d.decisions || [])
      setTrades(tlist)
      setDecisions(dlist)
      if (dlist.length > 0) setDecId(dlist[0].decision_id)
    }).catch(() => {})
  }, [])

  const generate = async () => {
    setLoading(true)
    try {
      let r
      if (type === 'POSTMORTEM') {
        r = await api.postmortemPacket(decId)
      } else {
        const body = {}
        if (tradeId) body.trade_id = tradeId
        if (decId) body.decision_id = decId
        r = await api.attributionPacket(body)
      }
      setPacket(r.markdown || r.packet || JSON.stringify(r, null, 2))
    } catch (e) {
      setPacket(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const copy = () => {
    navigator.clipboard?.writeText(packet).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const download = () => {
    const blob = new Blob([packet], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const filename = type === 'POSTMORTEM' ? `postmortem_${shortId(decId, 8)}.md` : `attribution_${shortId(tradeId || decId, 8)}.md`
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const valid = type === 'POSTMORTEM' ? !!decId : !!(tradeId || decId)

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[7] · export review packets · export_attribution_packet / export_postmortem_packet</div>
          <div className="h-stat lg mt-1">EXPORT REVIEW PACKETS</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            markdown that you paste into GPT or Claude. Output also saves to <span className="mono">data/processed/</span> via save_packet.
          </div>
        </div>
      </div>

      <div className="export-grid">
        <div className="panel p-4 col gap-4">
          <div className="col">
            <label className="in-label">packet_type</label>
            <div className="col gap-2">
              {[
                ['ATTRIBUTION', 'export_attribution_packet(conn, trade_id | decision_id)', 'Send the trade or decision context to the assistant; ask if it recommended this.'],
                ['POSTMORTEM', 'export_postmortem_packet(conn, decision_id)', 'Send the full thesis + outcome; ask for honest process critique.'],
              ].map(([t, sig, desc]) => (
                <button key={t} className={'big-pick ' + (type === t ? 'active' : '')} onClick={() => setType(t)}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="mono brand">{t}</span>
                    {type === t && <span className="brand">●</span>}
                  </div>
                  <div className="mono dim mt-1" style={{ fontSize: 10, textAlign: 'left' }}>{sig}</div>
                  <div className="dim mt-2" style={{ fontSize: 11, textAlign: 'left' }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {type === 'ATTRIBUTION' && (
            <>
              <div className="col">
                <label className="in-label">trade_id · optional</label>
                <select className="in" value={tradeId} onChange={e => setTradeId(e.target.value)}>
                  <option value="">— none —</option>
                  {trades.map(t => (
                    <option key={t.trade_id} value={t.trade_id}>
                      {shortId(t.trade_id, 10)} · {t.side} {t.outcome} @ {fmtPrice(t.price)} · {(t.market_slug || '').slice(0, 40)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col">
                <label className="in-label">decision_id · optional</label>
                <select className="in" value={decId} onChange={e => setDecId(e.target.value)}>
                  <option value="">— none —</option>
                  {decisions.map(d => (
                    <option key={d.decision_id} value={d.decision_id}>
                      {shortId(d.decision_id, 12)} · {d.project} · {d.side} {d.outcome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dim mono" style={{ fontSize: 10 }}>at least one of (trade_id, decision_id) required.</div>
            </>
          )}

          {type === 'POSTMORTEM' && (
            <div className="col">
              <label className="in-label">decision_id · required</label>
              <select className="in" value={decId} onChange={e => setDecId(e.target.value)}>
                {decisions.map(d => (
                  <option key={d.decision_id} value={d.decision_id}>
                    {shortId(d.decision_id, 12)} · {d.project} · {(d.market_title || '').slice(0, 40)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="div-dashed" />

          <div className="col gap-2">
            <Btn kind="primary" onClick={generate} disabled={!valid || loading}>
              {loading ? '⏳ GENERATING…' : '▶ GENERATE PACKET'}
            </Btn>
            {packet && (
              <>
                <Btn onClick={copy}>⌗ {copied ? '✓ COPIED' : 'COPY MARKDOWN'}</Btn>
                <Btn onClick={download}>$ SAVE .md</Btn>
              </>
            )}
            <Btn kind="ghost">$ OPEN_IN_GPT</Btn>
            <Btn kind="ghost">$ OPEN_IN_CLAUDE</Btn>
          </div>

          <div className="dim mt-2" style={{ fontSize: 10 }}>
            <span className="warn">⚠</span> the packet is regenerated each call from immutable trades_raw + editable decisions/attributions/postmortems.
            Pair it with <span className="mono">prompts/attribution_prompt.md</span>.
          </div>
        </div>

        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-hd">
            <span className="h-comment">packet · markdown · ready to paste</span>
            {packet && <span className="mono dim" style={{ fontSize: 10 }}>{packet.length} chars · ~{Math.round(packet.length / 4)} tok</span>}
          </div>
          <div className="markdown-preview" style={{ flex: 1, padding: 16 }}>
            {packet
              ? <pre>{packet}</pre>
              : <div className="dim" style={{ fontSize: 12 }}>click ▶ GENERATE PACKET to build the markdown.</div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
