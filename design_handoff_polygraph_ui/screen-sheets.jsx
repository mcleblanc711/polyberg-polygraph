/* ============================================
   Polygraph — Export to Sheets  (tabs[8])
   Mirrors ledger.sheets_export.export_to_sheets:
     - Service-account JSON via gspread
     - Overwrites 4 worksheets: Trades, Decisions, Attributions, Postmortems
     - Returns {worksheet_name: row_count}
     - Graceful degradation if gspread is not installed
   ============================================ */
const { useState: useStateS } = React;

function ExportToSheets({ go }) {
  const M = window.MOCK;
  const H = window.MOCK_HELPERS;
  const c = H.counts();

  const [spreadsheet, setSpreadsheet] = useStateS("https://docs.google.com/spreadsheets/d/1aBcD3F4gHiJ5KlMnOpQrStUvWxYz_polygraph/edit");
  const [credsPath, setCredsPath]     = useStateS("credentials.json");
  const [gspreadInstalled, setGspreadInstalled] = useStateS(true);
  const [stage, setStage] = useStateS("CONFIGURE"); // CONFIGURE · CONFIRM · DONE

  // Mocked counts that would land in each sheet
  const willExport = {
    Trades:        M.TRADES.length,
    Decisions:     M.DECISIONS.length,
    Attributions:  M.ATTRIBUTIONS_ROWS.length,
    Postmortems:   M.POSTMORTEMS.length,
  };

  const isUrl = spreadsheet.includes("docs.google.com");
  const spreadsheetId = isUrl
    ? (spreadsheet.match(/\/d\/([^/]+)/)?.[1] ?? "")
    : spreadsheet.trim();

  return (
    <div className="screen">
      <div className="screen-hd">
        <div className="col">
          <div className="h-comment">tabs[8] · export to sheets · `sheets_export.export_to_sheets()`</div>
          <div className="h-stat lg mt-1">EXPORT TO SHEETS</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            overwrites <span className="mono">Trades / Decisions / Attributions / Postmortems</span> worksheets via gspread + a Google service account.
          </div>
        </div>
      </div>

      <div className="screen-body" style={{ padding: 24, overflowY: "auto" }}>
        {/* gspread guard */}
        {!gspreadInstalled && (
          <div className="panel p-3 mb-4" style={{ borderLeft: "3px solid var(--red)" }}>
            <div className="row gap-2">
              <span className="neg">●</span>
              <span className="mono neg">gspread is not installed</span>
            </div>
            <div className="dim mt-2" style={{ fontSize: 11 }}>
              Run <span className="mono">pip install 'polyberg-polygraph[sheets]'</span>. The Sheets tab degrades gracefully when the optional dependency is missing.
            </div>
            <div className="mt-2">
              <Btn kind="ghost" size="sm" onClick={() => setGspreadInstalled(true)}>simulate install ✓</Btn>
            </div>
          </div>
        )}

        <div className="export-grid">
          {/* LEFT: config */}
          <div className="panel p-4 col gap-4">
            {stage === "CONFIGURE" && (
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
                  <table className="tbl" style={{ background: "transparent" }}>
                    <thead><tr><th>worksheet</th><th className="num">rows</th><th>source</th></tr></thead>
                    <tbody>
                      <tr><td className="mono brand">Trades</td><td className="num mono">{willExport.Trades}</td><td className="mono dim">trades_raw</td></tr>
                      <tr><td className="mono brand">Decisions</td><td className="num mono">{willExport.Decisions}</td><td className="mono dim">decisions</td></tr>
                      <tr><td className="mono brand">Attributions</td><td className="num mono">{willExport.Attributions}</td><td className="mono dim">assistant_attributions</td></tr>
                      <tr><td className="mono brand">Postmortems</td><td className="num mono">{willExport.Postmortems}</td><td className="mono dim">postmortems</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="panel p-3" style={{ borderLeft: "3px solid var(--amber)" }}>
                  <div className="row gap-2">
                    <span className="warn">⚠</span>
                    <span className="warn mono" style={{ fontSize: 11 }}>existing worksheets ARE OVERWRITTEN</span>
                  </div>
                  <div className="dim mt-2" style={{ fontSize: 11 }}>
                    The service-account email must have <span className="mono">editor</span> access to this spreadsheet. Shares are managed in the Google Sheet, not here.
                  </div>
                </div>

                <div className="row gap-2">
                  <Btn kind="primary" disabled={!spreadsheetId || !credsPath} onClick={() => setStage("CONFIRM")}>▶ EXPORT ALL TABLES</Btn>
                  <Btn kind="ghost" onClick={() => { setSpreadsheet(""); setCredsPath("credentials.json"); }}>RESET</Btn>
                </div>
              </>
            )}

            {stage === "CONFIRM" && (
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
                  <Btn kind="primary" onClick={() => setStage("DONE")}>✓ CONFIRM · overwrite 4 worksheets</Btn>
                  <Btn kind="ghost" onClick={() => setStage("CONFIGURE")}>BACK</Btn>
                </div>
              </>
            )}

            {stage === "DONE" && (
              <>
                <div className="h-comment mb-2">✓ exported</div>
                <pre className="mono" style={{ fontSize: 11, background: "var(--bg-1)", border: "1px solid var(--border-1)", padding: 12, color: "var(--text-1)" }}>
{JSON.stringify(willExport, null, 2)}
                </pre>
                <div className="row gap-2 mt-3">
                  <Btn kind="primary" onClick={() => window.open(isUrl ? spreadsheet : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, "_blank")}>▶ OPEN IN GOOGLE SHEETS</Btn>
                  <Btn kind="ghost" onClick={() => setStage("CONFIGURE")}>EXPORT AGAIN</Btn>
                </div>
              </>
            )}
          </div>

          {/* RIGHT: worksheet schemas preview */}
          <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
            <div className="panel-hd">
              <span className="h-comment">worksheet preview</span>
              <span className="dim mono" style={{ fontSize: 10 }}>first row = header · subsequent = data</span>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: 12 }} className="col gap-4">
              <SheetPreview title="Trades" rows={M.TRADES.slice(0, 5).map(t => ({
                trade_id: t.trade_id, timestamp: t.timestamp, market_slug: t.market_slug,
                outcome: t.outcome, side: t.side, action: t.action,
                price: t.price, shares: t.shares, notional: t.notional, fees: t.fees,
              }))} totalRows={willExport.Trades} />

              <SheetPreview title="Decisions" rows={M.DECISIONS.slice(0, 3).map(d => ({
                decision_id: H.shortId(d.decision_id, 10), project: d.project, sleeve: d.sleeve,
                market_slug: d.market_slug, side: d.side, outcome: d.outcome,
                price_used: d.price_used, status: d.status,
              }))} totalRows={willExport.Decisions} />

              <SheetPreview title="Attributions" rows={M.ATTRIBUTIONS_ROWS.slice(0, 4).map(a => ({
                attribution_id: H.shortId(a.attribution_id, 10),
                subject: a.decision_id ? H.shortId(a.decision_id, 10) : H.shortId(a.trade_id, 9),
                assistant: a.assistant, attribution: a.attribution,
                match_quality: a.match_quality.toFixed(2), review_status: a.review_status,
              }))} totalRows={willExport.Attributions} />

              <SheetPreview title="Postmortems" rows={M.POSTMORTEMS.slice(0, 3).map(p => ({
                postmortem_id: H.shortId(p.postmortem_id, 9),
                decision_id: H.shortId(p.decision_id, 10),
                pnl: p.pnl, thesis_quality: p.thesis_quality,
                primary_error_type: p.primary_error_type,
              }))} totalRows={willExport.Postmortems} />
            </div>
          </div>
        </div>

        {/* History */}
        <div className="panel" style={{ marginTop: 24 }}>
          <div className="panel-hd">
            <span className="h-comment">export history</span>
          </div>
          <table className="tbl">
            <thead><tr><th>exported_at</th><th>spreadsheet</th><th className="num">trades</th><th className="num">decisions</th><th className="num">attributions</th><th className="num">postmortems</th><th>actor</th></tr></thead>
            <tbody>
              {M.SHEETS_RUNS.map(r => (
                <tr key={r.run_id}>
                  <td className="id mono">{r.exported_at}</td>
                  <td className="mono">{r.spreadsheet_name} <span className="dim" style={{ fontSize: 10 }}>· {H.shortId(r.spreadsheet_id, 14)}</span></td>
                  <td className="num mono">{r.counts.Trades}</td>
                  <td className="num mono">{r.counts.Decisions}</td>
                  <td className="num mono">{r.counts.Attributions}</td>
                  <td className="num mono">{r.counts.Postmortems}</td>
                  <td className="mono dim">{r.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SheetPreview({ title, rows, totalRows }) {
  if (!rows.length) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div className="raw-block">
      <div className="row" style={{ justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--border-1)" }}>
        <span className="mono brand">{title}</span>
        <span className="mono dim" style={{ fontSize: 10 }}>{totalRows} rows total · showing first {rows.length}</span>
      </div>
      <table className="tbl" style={{ background: "transparent", fontSize: 10 }}>
        <thead>
          <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map(c => <td key={c} className="mono">{String(r[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

window.ExportToSheets = ExportToSheets;
