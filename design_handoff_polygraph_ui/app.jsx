/* ============================================
   Polygraph — App shell
   Mirrors the 9 real Streamlit tabs in app/streamlit_app.py.
   ============================================ */
const { useState: useStateA, useEffect: useEffectA } = React;

const NAV = [
  { id: "import",      label: "IMPORT",       hotkey: "1" },
  { id: "transcripts", label: "TRANSCRIPTS",  hotkey: "2" },
  { id: "ledger",      label: "LEDGER",       hotkey: "3" },
  { id: "unlinked",    label: "UNLINKED",     hotkey: "4" },
  { id: "decisions",   label: "DECISIONS",    hotkey: "5" },
  { id: "attribution", label: "ATTRIBUTION",  hotkey: "6" },
  { id: "postmortems", label: "POST-MORTEMS", hotkey: "7" },
  { id: "packets",     label: "PACKETS",      hotkey: "8" },
  { id: "sheets",      label: "SHEETS",       hotkey: "9" },
  { id: "attr-prompt", label: "ATTR PROMPT",  hotkey: "0" },
];

function PolygraphApp({ initialScreen = "ledger", density = "minimal" }) {
  const [screen, setScreen] = useStateA(initialScreen);
  const c = window.MOCK_HELPERS.counts();
  const navBadge = (id) => {
    if (id === "unlinked")    return c.unlinked;
    if (id === "attribution") return c.needsReview;
    if (id === "postmortems") return c.pendingPM;
    return null;
  };

  const go = (s) => setScreen(s);

  return (
    <div className={"app density-" + density}>
      <TopBar screen={screen} go={go} navBadge={navBadge} />

      <main className="main">
        {screen === "import"      && <ImportTrades go={go} />}
        {screen === "transcripts" && <ImportTranscripts go={go} />}
        {screen === "ledger"      && <TradeLedger go={go} />}
        {screen === "unlinked"    && <UnlinkedTrades go={go} />}
        {screen === "decisions"   && <Decisions   go={go} />}
        {screen === "attribution" && <Attribution go={go} />}
        {screen === "postmortems" && <PostMortems go={go} />}
        {screen === "packets"     && <ExportPackets go={go} />}
        {screen === "sheets"      && <ExportToSheets go={go} />}
        {screen === "attr-prompt" && <AttributionPrompt go={go} />}
      </main>

      <StatusBar screen={screen} />
    </div>
  );
}

function TopBar({ screen, go, navBadge }) {
  return (
    <header className="topbar">
      {/* brand block */}
      <div className="tb-brand">
        <div className="tb-brand-mark">
          <LogoMark size={14} />
        </div>
        <div className="tb-brand-text">
          <span style={{ color: "var(--text-0)", fontWeight: 700 }}>p<span style={{ color: "var(--magenta)" }}>0</span>lygraph</span>
          <span className="tb-brand-sub">/ ledger</span>
        </div>
        <div className="tb-brand-ver">v0.1.0</div>
      </div>

      {/* tabs */}
      <nav className="tb-tabs">
        {NAV.map(n => {
          const active = screen === n.id;
          const badge = navBadge(n.id);
          return (
            <button
              key={n.id}
              className={"tb-tab " + (active ? "active" : "")}
              onClick={() => go(n.id)}
              title={`${n.label} · ${n.hotkey}`}
            >
              {n.label}
              {badge != null && badge > 0 && (
                <span className={"tb-badge " + (active ? "on" : "")}>{badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* right cluster */}
      <div className="tb-right">
        <div className="tb-search">
          <span style={{ color: "var(--text-3)" }}>⌕</span>
          <input placeholder="jump to market / trade_id…" />
          <span className="kbd">⌘K</span>
        </div>
        <div className="tb-mode" title="No network calls. Reads & writes hit data/processed/polygraph.sqlite.">
          <span className="tb-mode-dot" />
          LOCAL · APPEND-ONLY
        </div>
        <button className="btn ghost sm" onClick={() => go("import")}>$ IMPORT_CSV</button>
        <button className="btn primary sm" onClick={() => go("unlinked")}>RUN NEXT REVIEW ▸</button>
      </div>
    </header>
  );
}

function StatusBar({ screen }) {
  const c = window.MOCK_HELPERS.counts();
  return (
    <footer className="statusbar">
      <span className="sb-item"><span className="sb-dot pos" /> SQLITE · data/processed/polygraph.sqlite</span>
      <span className="sb-item" style={{ color: "var(--cyan)" }}>● trades_raw LOCKED · APPEND-ONLY</span>
      <span className="sb-item">SCREEN <span style={{ color: "var(--magenta)" }}>{(NAV.find(n => n.id === screen)?.label || screen).toUpperCase()}</span></span>
      <span style={{ flex: 1 }} />
      <span className="sb-item">{c.trades} FILLS · {c.decisions} DECISIONS · {c.attributions} ATTRIBUTIONS · {c.postmortems} POST-MORTEMS</span>
      <span className="sb-item">dedupe by source_row_hash <span style={{ color: "var(--cyan)" }}>✓</span></span>
      {c.needsReview > 0 && (
        <span className="sb-item" style={{ color: "var(--amber)" }}>● {c.needsReview} NEEDS_REVIEW</span>
      )}
    </footer>
  );
}

window.PolygraphApp = PolygraphApp;
