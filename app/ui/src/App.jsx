import { useState, useEffect } from 'react'
import { api } from './api.js'
import { NAV } from './constants.js'
import { LogoMark } from './components.jsx'
import Import from './screens/Import.jsx'
import Transcripts from './screens/Transcripts.jsx'
import Ledger from './screens/Ledger.jsx'
import Unlinked from './screens/Unlinked.jsx'
import Decisions from './screens/Decisions.jsx'
import Attribution from './screens/Attribution.jsx'
import PostMortems from './screens/PostMortems.jsx'
import Packets from './screens/Packets.jsx'
import Sheets from './screens/Sheets.jsx'
import AttrPrompt from './screens/AttrPrompt.jsx'

export default function App() {
  const [screen, setScreen] = useState("ledger")
  const [status, setStatus] = useState({ trades: 0, decisions: 0, attributions: 0, postmortems: 0, needs_review: 0, unlinked: 0, pending_pm: 0 })

  useEffect(() => {
    const load = () => api.status().then(setStatus).catch(() => {})
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return
      const n = NAV.find(n => n.hotkey === e.key)
      if (n) setScreen(n.id)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const go = (s) => setScreen(s)
  const refreshStatus = () => api.status().then(setStatus).catch(() => {})

  const navBadge = (id) => {
    if (id === "unlinked")    return status.unlinked
    if (id === "attribution") return status.needs_review
    if (id === "postmortems") return status.pending_pm
    return null
  }

  return (
    <div className="app">
      <TopBar screen={screen} go={go} navBadge={navBadge} />
      <main className="main" style={{ position: "relative" }}>
        {screen === "import"      && <Import       go={go} onDone={refreshStatus} />}
        {screen === "transcripts" && <Transcripts  go={go} onDone={refreshStatus} />}
        {screen === "ledger"      && <Ledger       go={go} />}
        {screen === "unlinked"    && <Unlinked     go={go} onDone={refreshStatus} />}
        {screen === "decisions"   && <Decisions    go={go} onDone={refreshStatus} />}
        {screen === "attribution" && <Attribution  go={go} onDone={refreshStatus} />}
        {screen === "postmortems" && <PostMortems  go={go} onDone={refreshStatus} />}
        {screen === "packets"     && <Packets      go={go} />}
        {screen === "sheets"      && <Sheets       go={go} />}
        {screen === "attr-prompt" && <AttrPrompt   go={go} />}
      </main>
      <StatusBar screen={screen} status={status} />
    </div>
  )
}

function TopBar({ screen, go, navBadge }) {
  return (
    <header className="topbar">
      <div className="tb-brand">
        <div className="tb-brand-mark"><LogoMark size={14} /></div>
        <div className="tb-brand-text">
          <span style={{ color: "var(--text-0)", fontWeight: 700 }}>p<span style={{ color: "var(--magenta)" }}>0</span>lygraph</span>
          <span className="tb-brand-sub">/ ledger</span>
        </div>
        <div className="tb-brand-ver">v0.1.0</div>
      </div>

      <nav className="tb-tabs">
        {NAV.map(n => {
          const active = screen === n.id
          const badge = navBadge(n.id)
          return (
            <button key={n.id} className={"tb-tab " + (active ? "active" : "")} onClick={() => go(n.id)} title={`${n.label} · ${n.hotkey}`}>
              {n.label}
              {badge != null && badge > 0 && <span className={"tb-badge " + (active ? "on" : "")}>{badge}</span>}
            </button>
          )
        })}
      </nav>

      <div className="tb-right">
        <div className="tb-search">
          <span style={{ color: "var(--text-3)" }}>⌕</span>
          <input placeholder="jump to market / trade_id…" />
          <span className="kbd">⌘K</span>
        </div>
        <div className="tb-mode" title="No network calls beyond local API. Reads & writes hit data/processed/polygraph.sqlite.">
          <span className="tb-mode-dot" />
          LOCAL · APPEND-ONLY
        </div>
        <button className="btn ghost sm" onClick={() => go("import")}>$ IMPORT_CSV</button>
        <button className="btn primary sm" onClick={() => go("unlinked")}>RUN NEXT REVIEW ▸</button>
      </div>
    </header>
  )
}

function StatusBar({ screen, status }) {
  return (
    <footer className="statusbar">
      <span className="sb-item"><span className="sb-dot pos" /> SQLITE · data/processed/polygraph.sqlite</span>
      <span className="sb-item" style={{ color: "var(--cyan)" }}>● trades_raw LOCKED · APPEND-ONLY</span>
      <span className="sb-item">SCREEN <span style={{ color: "var(--magenta)" }}>{(NAV.find(n => n.id === screen)?.label || screen).toUpperCase()}</span></span>
      <span style={{ flex: 1 }} />
      <span className="sb-item">{status.trades} FILLS · {status.decisions} DECISIONS · {status.attributions} ATTRIBUTIONS · {status.postmortems} POST-MORTEMS</span>
      <span className="sb-item">dedupe by source_row_hash <span style={{ color: "var(--cyan)" }}>✓</span></span>
      {status.needs_review > 0 && <span className="sb-item" style={{ color: "var(--amber)" }}>● {status.needs_review} NEEDS_REVIEW</span>}
    </footer>
  )
}
