/* ============================================
   Polygraph — shared UI components
   ============================================ */
const { useState, useEffect, useRef, useMemo } = React;

// ---- Chip ----
function Chip({ kind = "default", children, size, title }) {
  const cls = `chip ${size === "lg" ? "lg" : ""} chip-${kind}`;
  return <span className={cls} title={title}>{children}</span>;
}

// ---- Attribution chip ----
// Distinguishes NO_MATCH_FOUND (relevant convo searched, no match) from NOT_INVOLVED (assistant not part of decision).
function AttrChip({ assistant, value, status = "USER_CONFIRMED", compact = false }) {
  if (!value) return <span className="dim mono" style={{ fontSize: 10 }}>—</span>;
  const tone = (() => {
    switch (value) {
      case "DIRECT_RECOMMENDATION":         return { kind: assistant, label: "DIRECT_REC", glyph: "●" };
      case "SUPPORTED_AFTER_REVIEW":        return { kind: assistant, label: "SUPPORTED",  glyph: "◐" };
      case "OPPOSED":                       return { kind: "neg",     label: "OPPOSED",    glyph: "◯" };
      case "MENTIONED_BUT_NOT_RECOMMENDED": return { kind: "warn",    label: "MENTIONED",  glyph: "◌" };
      case "NO_MATCH_FOUND":                return { kind: "draft",   label: "NO_MATCH",   glyph: "∅", title: "Conversations searched — no matching recommendation found." };
      case "NOT_INVOLVED":                  return { kind: "draft",   label: "N/A",        glyph: "—", title: "Assistant was not part of this decision flow." };
      case "UNCLEAR":                       return { kind: "warn",    label: "UNCLEAR",    glyph: "?" };
      default: return { kind: "draft", label: value, glyph: "•" };
    }
  })();
  const proposed = status === "MODEL_PROPOSED";
  const dashedStyle = proposed ? { borderStyle: "dashed" } : undefined;
  const klass = `chip chip-${tone.kind}`;
  return (
    <span className={klass} style={dashedStyle} title={tone.title || value}>
      <span style={{ opacity: 0.8, marginRight: 2 }}>{tone.glyph}</span>
      {compact ? tone.label : (assistant === "gpt" ? "GPT" : "CLAUDE") + " · " + tone.label}
      {proposed && <span style={{ opacity: 0.6, marginLeft: 4 }}>?</span>}
    </span>
  );
}

// ---- Button ----
function Btn({ kind, size, onClick, children, title, disabled, style }) {
  const cls = ["btn", kind || "", size || ""].filter(Boolean).join(" ");
  return <button className={cls} onClick={onClick} title={title} disabled={disabled} style={style}>{children}</button>;
}

function CmdBtn({ onClick, children, title }) {
  return <button className="btn-cmd" onClick={onClick} title={title}>{children}</button>;
}

// ---- Stat card (sparse, dashboard hero) ----
function StatCard({ label, value, sub, tone, big, onClick, hot }) {
  const valClass = "h-stat" + (big ? " lg" : "") + (tone ? " " + tone : "");
  return (
    <div className="stat-card" onClick={onClick} style={{
      cursor: onClick ? "pointer" : "default",
      borderColor: hot ? "var(--magenta-dim)" : undefined,
    }}>
      <div className="h-caps" style={{ marginBottom: 8 }}>{label}</div>
      <div className={valClass}>{value}</div>
      {sub && <div className="dim" style={{ marginTop: 6, fontSize: 11 }}>{sub}</div>}
      {hot && <div className="stat-pulse" />}
    </div>
  );
}

// ---- Section header ("// research workflow") ----
function SectionH({ children, right }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
      <h3 className="h-comment">{children}</h3>
      {right}
    </div>
  );
}

// ---- Sparkline ----
function Sparkline({ data, color = "var(--magenta)", w = 80, h = 22 }) {
  if (!data || !data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline fill="none" stroke={color} strokeWidth="1" points={pts} />
    </svg>
  );
}

// ---- Bar (for project P&L) ----
function HBar({ value, max, neg }) {
  const pct = Math.min(100, (Math.abs(value) / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", height: 4, background: "var(--bg-3)", width: "100%" }}>
      <div style={{
        width: `${pct}%`,
        height: "100%",
        background: neg ? "var(--red)" : "var(--green)",
      }} />
    </div>
  );
}

// ---- Polygraph waveform ----
// Animated lie-detector trace. Multi-trace for "GPT" / "Claude" / "P&L" lanes.
function PolygraphWaveform({ height = 140, lanes, running = true }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf, t = 0;
    const tick = () => {
      const svg = ref.current;
      if (!svg) return;
      t += running ? 1 : 0;
      const w = svg.clientWidth || 600;
      const lanePaths = svg.querySelectorAll("[data-lane]");
      lanePaths.forEach((path, idx) => {
        const lane = lanes[idx];
        const samples = 120;
        const laneH = height / lanes.length;
        const yMid = laneH * idx + laneH / 2;
        const pts = [];
        for (let i = 0; i < samples; i++) {
          const x = (i / (samples - 1)) * w;
          const phase = (t * 0.04) + i * 0.18;
          const noise = (Math.sin(phase + idx * 1.7) * 0.35
                        + Math.sin(phase * 1.7 + idx) * 0.20
                        + Math.sin(phase * 0.4) * 0.15
                        + (Math.random() - 0.5) * 0.05) * (lane.amp || 1);
          // Inject a spike pattern based on lane.spike timing
          const spike = lane.spikes && lane.spikes.some(s => Math.abs(((i + t * 0.5) % samples) - s) < 1.5)
            ? (Math.sin((t + i) * 0.8) * 0.9) : 0;
          const y = yMid + (noise + spike) * (laneH * 0.4);
          pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        }
        path.setAttribute("points", pts.join(" "));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lanes, height, running]);

  const laneH = height / lanes.length;
  return (
    <div style={{ position: "relative" }}>
      <svg ref={ref} width="100%" height={height} style={{ display: "block" }}>
        {/* grid */}
        <defs>
          <pattern id="pg-grid" width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M40 0L0 0 0 20" fill="none" stroke="var(--border-0)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="100%" height={height} fill="url(#pg-grid)" />
        {lanes.map((lane, i) => (
          <g key={lane.label}>
            <line x1="0" x2="100%" y1={laneH * (i + 1)} y2={laneH * (i + 1)} stroke="var(--border-1)" strokeDasharray="2 4" />
            <text x="6" y={laneH * i + 12} fill="var(--text-3)" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="0.1em">
              {lane.label}
            </text>
            <polyline
              data-lane={i}
              fill="none"
              stroke={lane.color}
              strokeWidth="1.2"
              opacity="0.95"
              style={{ filter: `drop-shadow(0 0 4px ${lane.color}66)` }}
            />
          </g>
        ))}
        {/* live cursor */}
        <line x1="98%" x2="98%" y1="0" y2={height} stroke="var(--magenta)" opacity="0.4" />
        <text x="100%" y="12" textAnchor="end" fill="var(--magenta)" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="0.1em">
          ▌LIVE
        </text>
      </svg>
    </div>
  );
}

// ---- ID display ----
function IdMono({ id, copyable = true }) {
  const [copied, setCopied] = useState(false);
  const onClick = () => {
    if (!copyable) return;
    navigator.clipboard?.writeText(id).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  };
  return (
    <span
      className="mono"
      style={{ color: "var(--text-2)", fontSize: 10, cursor: copyable ? "pointer" : "default" }}
      onClick={onClick}
      title={copyable ? "Click to copy" : ""}
    >
      {copied ? "copied" : id}
    </span>
  );
}

// ---- Status chip helpers ----
function ReviewStatus({ status }) {
  const map = {
    DRAFT:           { kind: "draft",     label: "DRAFT" },
    MODEL_PROPOSED:  { kind: "proposed",  label: "MODEL_PROPOSED" },
    USER_CONFIRMED:  { kind: "confirmed", label: "USER_CONFIRMED" },
    REJECTED:        { kind: "rejected",  label: "REJECTED" },
    NEEDS_REVIEW:    { kind: "needs-rev", label: "NEEDS_REVIEW" },
  };
  const it = map[status] || { kind: "draft", label: status };
  return <Chip kind={it.kind}>{it.label}</Chip>;
}

// ---- Empty state ----
function Empty({ title, hint, children }) {
  return (
    <div style={{
      border: "1px dashed var(--border-1)",
      padding: "40px 20px",
      textAlign: "center",
      color: "var(--text-2)",
      background: "repeating-linear-gradient(135deg, transparent 0 6px, var(--bg-1) 6px 7px)",
    }}>
      <div className="h-comment" style={{ marginBottom: 8 }}>nothing here</div>
      <div className="h-stat sm" style={{ color: "var(--text-1)" }}>{title}</div>
      {hint && <div className="dim" style={{ marginTop: 8, fontSize: 11 }}>{hint}</div>}
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </div>
  );
}

// ---- Drawer ----
function Drawer({ open, onClose, title, children, width = 480, side = "right" }) {
  if (!open) return null;
  return (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      style={{
        position: "absolute", inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 30,
        display: "flex",
        justifyContent: side === "right" ? "flex-end" : "flex-start",
      }}
    >
      <div
        className="drawer panel"
        onClick={e => e.stopPropagation()}
        style={{
          width, height: "100%",
          background: "var(--bg-1)",
          borderLeft: side === "right" ? "1px solid var(--border-2)" : "none",
          borderRight: side === "left" ? "1px solid var(--border-2)" : "none",
          display: "flex", flexDirection: "column",
          boxShadow: "-20px 0 40px rgba(0,0,0,0.6)",
        }}
      >
        <div className="panel-hd">
          <div className="h-caps">{title}</div>
          <button className="btn ghost sm" onClick={onClose}>✕ CLOSE</button>
        </div>
        <div className="panel-body" style={{ overflowY: "auto", flex: 1, padding: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ---- Logo mark — polyberg-style peak line ----
function LogoMark({ size = 14 }) {
  const w = size * 1.4;
  return (
    <svg width={w} height={size} viewBox="0 0 24 16">
      <path
        d="M2 14 L2 6 L6 3 L10 11 L13 5 L17 13 L22 7 L22 14"
        fill="none"
        stroke="var(--magenta)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 4px var(--magenta-glow))" }}
      />
    </svg>
  );
}

// ---- Mini trace (for inline rows) ----
function MiniTrace({ height = 12, width = 60, seed = 1, color = "var(--cyan)" }) {
  const pts = [];
  const samples = 30;
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * width;
    const y = height / 2 + Math.sin(i * 0.5 + seed) * 2 + Math.sin(i * 1.3 + seed * 2) * 2.5 + (i === 12 + seed % 8 ? 4 : 0);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return (
    <svg width={width} height={height}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1" opacity="0.9" />
    </svg>
  );
}

Object.assign(window, {
  Chip, AttrChip, Btn, CmdBtn, StatCard, SectionH,
  Sparkline, HBar, PolygraphWaveform, IdMono, ReviewStatus, Empty, Drawer, LogoMark, MiniTrace,
});
