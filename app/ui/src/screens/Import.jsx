import { useState, useCallback } from 'react'
import { api } from '../api.js'
import { Chip, Btn, CmdBtn } from '../components.jsx'
import { fmtTs } from '../constants.js'

export default function Import({ go, onDone }) {
  const [stage, setStage] = useState('DROP')
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [dragging, setDragging] = useState(false)

  const loadHistory = useCallback(() => {
    // history endpoint not in api.js — skip gracefully
  }, [])

  const handleFile = (f) => {
    if (!f || !f.name.endsWith('.csv')) { setError('Only .csv files are accepted.'); return }
    setFile(f)
    setError(null)
    setStage('PREVIEW')
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    handleFile(f)
  }

  const onInput = (e) => {
    const f = e.target.files[0]
    handleFile(f)
  }

  const commit = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const r = await api.importCsv(file)
      setResult(r)
      setStage('DONE')
      onDone?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setStage('DROP')
    setFile(null)
    setResult(null)
    setError(null)
  }

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[0] · import trades · import_trades_csv()</div>
          <div className="h-stat lg mt-1">IMPORT TRADES</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            polymarket CSV → <span className="mono">trades_raw</span> · dedupe by <span className="mono">source_row_hash</span> · <Chip kind="immutable">APPEND-ONLY</Chip>
          </div>
        </div>
      </div>

      <div className="screen-body" style={{ padding: 24, overflowY: 'auto' }}>
        <div className="row gap-3 mb-4" style={{ fontSize: 11 }}>
          {[
            ['DROP', '1 · pick CSV from data/raw_exports/'],
            ['PREVIEW', '2 · preview before commit'],
            ['DONE', '3 · committed'],
          ].map(([k, l]) => (
            <div key={k} className={'step ' + (stage === k ? 'active' : '')}>{l}</div>
          ))}
        </div>

        {error && (
          <div className="panel p-3 mb-4" style={{ borderLeft: '3px solid var(--red)' }}>
            <span className="neg mono" style={{ fontSize: 11 }}>⚠ {error}</span>
          </div>
        )}

        {stage === 'DROP' && (
          <div className="col gap-4">
            <div
              className="dropzone"
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onClick={() => document.getElementById('csv-input').click()}
              style={dragging ? { borderColor: 'var(--magenta)', boxShadow: 'inset 0 0 60px rgba(255,61,240,0.12)' } : undefined}
            >
              <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={onInput} />
              <div className="h-stat" style={{ color: 'var(--text-1)' }}>⌄ select CSV from data/raw_exports/</div>
              <div className="dim mt-2 mono" style={{ fontSize: 12 }}>drag & drop or click to browse · accepted: .csv</div>
              <div className="div-dashed" style={{ width: '60%', margin: '20px auto' }} />
              <div className="dim mt-2" style={{ fontSize: 11 }}>
                schema target: trade_id · timestamp · market_slug · market_title · outcome · side · action · price · shares · notional · fees
              </div>
            </div>
          </div>
        )}

        {stage === 'PREVIEW' && file && (
          <div className="col gap-4">
            <div className="panel">
              <div className="panel-hd">
                <span className="h-comment">column mapping · csv → trades_raw</span>
                <span className="dim mono" style={{ fontSize: 10 }}>{file.name} · {(file.size / 1024).toFixed(1)} KB</span>
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
                <table className="tbl">
                  <thead><tr><th>csv column</th><th></th><th>trades_raw field</th><th>sample</th></tr></thead>
                  <tbody>
                    <tr><td className="mono dim">timestamp_utc</td><td className="dim">→</td><td className="mono brand">timestamp</td><td className="mono dim">2026-05-22T14:03:11Z</td></tr>
                    <tr><td className="mono dim">condition_id</td><td className="dim">→</td><td className="mono brand">market_slug</td><td className="mono dim">hormuz-normal-end-june-2026</td></tr>
                    <tr><td className="mono dim">condition_title</td><td className="dim">→</td><td className="mono brand">market_title</td><td className="mono dim">Hormuz remains operationally…</td></tr>
                    <tr><td className="mono dim">outcome</td><td className="dim">→</td><td className="mono brand">outcome</td><td className="mono dim">No</td></tr>
                    <tr><td className="mono dim">side</td><td className="dim">→</td><td className="mono brand">side</td><td className="mono dim">BUY</td></tr>
                    <tr><td className="mono dim">tx_type</td><td className="dim">→</td><td className="mono brand">action</td><td className="mono dim">TRADE</td></tr>
                    <tr><td className="mono dim">price_usdc</td><td className="dim">→</td><td className="mono brand">price</td><td className="mono dim">0.360</td></tr>
                    <tr><td className="mono dim">shares</td><td className="dim">→</td><td className="mono brand">shares</td><td className="mono dim">127.789</td></tr>
                    <tr><td className="mono dim">notional_usdc</td><td className="dim">→</td><td className="mono brand">notional</td><td className="mono dim">46.00</td></tr>
                    <tr><td className="mono dim">fee_usdc</td><td className="dim">→</td><td className="mono brand">fees</td><td className="mono dim">0.092</td></tr>
                    <tr><td className="mono dim">row_hash</td><td className="dim">→</td><td className="mono brand">source_row_hash</td><td className="mono dim">a3f9c7…</td></tr>
                    <tr><td className="mono dim">(all)</td><td className="dim">→</td><td className="mono brand">raw_json</td><td className="mono dim">{'{...}'}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel p-3" style={{ borderLeft: '3px solid var(--amber)' }}>
              <div className="row gap-2">
                <span className="warn">⚠</span>
                <span className="warn mono" style={{ fontSize: 11 }}>trades_raw_no_update / trades_raw_no_delete triggers fire on any attempt to mutate</span>
              </div>
              <div className="dim mt-2" style={{ fontSize: 11 }}>
                Once committed these rows cannot be updated or deleted. All edits attach as annotations (decisions, links, attributions, postmortems) and never mutate raw data.
              </div>
            </div>

            <div className="row gap-2">
              <Btn kind="primary" onClick={commit} disabled={loading}>
                {loading ? 'COMMITTING…' : '▶ COMMIT'}
              </Btn>
              <Btn kind="ghost" onClick={reset}>CANCEL</Btn>
            </div>
          </div>
        )}

        {stage === 'DONE' && result && (
          <div className="panel p-4">
            <div className="h-comment mb-2">✓ import committed · ImportResult</div>
            <div className="h-stat pos">+{result.rows_imported} new fills</div>
            <pre className="mono mt-3" style={{ fontSize: 11, background: 'var(--bg-1)', border: '1px solid var(--border-1)', padding: 12, color: 'var(--text-1)' }}>
{JSON.stringify(result, null, 2)}
            </pre>
            <div className="div-dashed mt-3 mb-3" />
            <div className="row gap-2">
              <Btn kind="primary" onClick={() => go('unlinked')}>▶ REVIEW UNLINKED</Btn>
              <Btn onClick={() => go('ledger')}>OPEN LEDGER</Btn>
              <Btn kind="ghost" onClick={reset}>IMPORT ANOTHER</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
