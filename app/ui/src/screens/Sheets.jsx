import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { Btn } from '../components.jsx'

export default function Sheets({ go }) {
  const [stage, setStage] = useState('CONFIGURE')
  const [spreadsheet, setSpreadsheet] = useState('')
  const [credsPath, setCredsPath] = useState('credentials.json')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [counts, setCounts] = useState({ trades: 0, decisions: 0, attributions: 0, postmortems: 0 })

  useEffect(() => {
    api.status().then(s => setCounts(s)).catch(() => {})
  }, [])

  const isUrl = spreadsheet.includes('docs.google.com')
  const spreadsheetId = isUrl
    ? (spreadsheet.match(/\/d\/([^/]+)/)?.[1] ?? '')
    : spreadsheet.trim()

  const willExport = {
    Trades: counts.trades,
    Decisions: counts.decisions,
    Attributions: counts.attributions,
    Postmortems: counts.postmortems,
  }

  const doExport = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.exportSheets({ spreadsheet_id: spreadsheetId, credentials_path: credsPath })
      setResult(r)
      setStage('DONE')
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[8] · export to sheets · sheets_export.export_to_sheets()</div>
          <div className="h-stat lg mt-1">EXPORT TO SHEETS</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            overwrites <span className="mono">Trades / Decisions / Attributions / Postmortems</span> worksheets via gspread + a Google service account.
          </div>
        </div>
      </div>

      <div className="screen-body" style={{ padding: 24, overflowY: 'auto' }}>
        <div className="row gap-3 mb-4" style={{ fontSize: 11 }}>
          {[
            ['CONFIGURE', '1 · spreadsheet + credentials'],
            ['CONFIRM', '2 · review before export'],
            ['DONE', '3 · exported'],
          ].map(([k, l]) => (
            <div key={k} className={'step ' + (stage === k ? 'active' : '')}>{l}</div>
          ))}
        </div>

        {error && (
          <div className="panel p-3 mb-4" style={{ borderLeft: '3px solid var(--red)' }}>
            <span className="neg mono" style={{ fontSize: 11 }}>⚠ {error}</span>
          </div>
        )}

        <div className="export-grid">
          <div className="panel p-4 col gap-4">
            {stage === 'CONFIGURE' && (
              <>
                <div className="col">
                  <label className="in-label">spreadsheet URL or ID</label>
                  <input className="in" value={spreadsheet} onChange={e => setSpreadsheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…  or  1aBc..." />
                  {isUrl && spreadsheetId && (
                    <div className="dim mono mt-1" style={{ fontSize: 10 }}>parsed id → <span className="brand">{spreadsheetId}</span></div>
                  )}
                </div>

                <div className="col">
                  <label className="in-label">service-account credentials · JSON path</label>
                  <input className="in" value={credsPath} onChange={e => setCredsPath(e.target.value)} placeholder="credentials.json" />
                  <div className="dim mono mt-1" style={{ fontSize: 10 }}>
                    file downloaded from Google Cloud Console → Service Accounts → Keys → Add → JSON
                  </div>
                </div>

                <div className="raw-block p-3">
                  <div className="h-caps mb-2">will overwrite</div>
                  <table className="tbl" style={{ background: 'transparent' }}>
                    <thead><tr><th>worksheet</th><th className="num">rows</th><th>source</th></tr></thead>
                    <tbody>
                      <tr><td className="mono brand">Trades</td><td className="num mono">{willExport.Trades}</td><td className="mono dim">trades_raw</td></tr>
                      <tr><td className="mono brand">Decisions</td><td className="num mono">{willExport.Decisions}</td><td className="mono dim">decisions</td></tr>
                      <tr><td className="mono brand">Attributions</td><td className="num mono">{willExport.Attributions}</td><td className="mono dim">assistant_attributions</td></tr>
                      <tr><td className="mono brand">Postmortems</td><td className="num mono">{willExport.Postmortems}</td><td className="mono dim">postmortems</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="panel p-3" style={{ borderLeft: '3px solid var(--amber)' }}>
                  <div className="row gap-2">
                    <span className="warn">⚠</span>
                    <span className="warn mono" style={{ fontSize: 11 }}>existing worksheets ARE OVERWRITTEN</span>
                  </div>
                  <div className="dim mt-2" style={{ fontSize: 11 }}>
                    The service-account email must have <span className="mono">editor</span> access to this spreadsheet. Shares are managed in the Google Sheet, not here.
                  </div>
                </div>

                <div className="row gap-2">
                  <Btn kind="primary" disabled={!spreadsheetId || !credsPath} onClick={() => setStage('CONFIRM')}>▶ EXPORT ALL TABLES</Btn>
                  <Btn kind="ghost" onClick={() => { setSpreadsheet(''); setCredsPath('credentials.json') }}>RESET</Btn>
                </div>
              </>
            )}

            {stage === 'CONFIRM' && (
              <>
                <div className="h-comment">confirm export</div>
                <div className="raw-block p-3">
                  <div className="kv">
                    <div><span className="k">spreadsheet_id</span><span className="v mono">{spreadsheetId}</span></div>
                    <div><span className="k">credentials</span><span className="v mono">{credsPath}</span></div>
                    <div><span className="k">scope</span><span className="v mono dim">https://www.googleapis.com/auth/spreadsheets</span></div>
                  </div>
                </div>
                <div className="row gap-2">
                  <Btn kind="primary" onClick={doExport} disabled={loading}>{loading ? 'EXPORTING…' : '✓ CONFIRM · overwrite 4 worksheets'}</Btn>
                  <Btn kind="ghost" onClick={() => setStage('CONFIGURE')}>BACK</Btn>
                </div>
              </>
            )}

            {stage === 'DONE' && result && (
              <>
                <div className="h-comment mb-2">✓ exported</div>
                <pre className="mono" style={{ fontSize: 11, background: 'var(--bg-1)', border: '1px solid var(--border-1)', padding: 12, color: 'var(--text-1)' }}>
{JSON.stringify(result, null, 2)}
                </pre>
                <div className="row gap-2 mt-3">
                  <Btn kind="primary" onClick={() => window.open(isUrl ? spreadsheet : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, '_blank')}>▶ OPEN IN GOOGLE SHEETS</Btn>
                  <Btn kind="ghost" onClick={() => { setStage('CONFIGURE'); setResult(null) }}>EXPORT AGAIN</Btn>
                </div>
              </>
            )}
          </div>

          <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-hd">
              <span className="h-comment">worksheet schema reference</span>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: 16 }} className="col gap-4">
              <SchemaCard title="Trades" cols={['trade_id','timestamp','market_slug','market_title','outcome','side','action','price','shares','notional','fees','source_file','source_row_hash']} />
              <SchemaCard title="Decisions" cols={['decision_id','project','sleeve','market_slug','market_title','side','outcome','price_used','status','intent','decision_type','target_entry','target_exit','max_allocation','thesis_summary','rule_summary','catalyst','invalidation']} />
              <SchemaCard title="Attributions" cols={['attribution_id','trade_id','decision_id','assistant','attribution','match_quality','review_status','evidence_source','evidence','recommended_price','recommended_size']} />
              <SchemaCard title="Postmortems" cols={['postmortem_id','decision_id','pnl','thesis_quality','execution_quality','sizing_quality','exit_quality','rule_read_quality','primary_error_type','secondary_error_type','what_went_right','what_went_wrong','lesson_keep','lesson_change','never_repeat','future_rule']} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SchemaCard({ title, cols }) {
  return (
    <div className="raw-block">
      <div className="row" style={{ justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border-1)' }}>
        <span className="mono brand">{title}</span>
        <span className="mono dim" style={{ fontSize: 10 }}>{cols.length} columns</span>
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {cols.map(c => (
          <span key={c} className="mono dim" style={{ fontSize: 9.5, background: 'var(--bg-2)', border: '1px solid var(--border-0)', padding: '2px 5px' }}>{c}</span>
        ))}
      </div>
    </div>
  )
}
