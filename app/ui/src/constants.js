export const PROJECTS = ["GEO_OIL","ELECTIONS","SPORTS_MM","SPORTS_DIRECTIONAL","EXPERIMENTAL","CASH"]
export const SLEEVES = ["main", "scratch", "rules_lab"]
export const ASSISTANTS = ["GPT", "CLAUDE", "GROK", "USER"]
export const ATTRIBUTIONS = [
  "DIRECT_RECOMMENDATION","SUPPORTED_AFTER_REVIEW","OPPOSED",
  "MENTIONED_BUT_NOT_RECOMMENDED","NO_MATCH_FOUND","NOT_INVOLVED","UNCLEAR",
]
export const REVIEW_STATUSES = ["DRAFT","MODEL_PROPOSED","USER_CONFIRMED","REJECTED","NEEDS_REVIEW"]
export const DECISION_STATUSES = ["DRAFT","OPEN","RESOLVED_WIN","RESOLVED_LOSS","INVALIDATED"]
export const QUALITY_VALUES = ["EXCELLENT","GOOD","OK","POOR","BAD"]

export const REASON_GROUPS = [
  { name: "setup",         codes: ["RULE_ARB","CLEAN_ORACLE_NO","HEADLINE_OVERSHOOT","FAST_INFO_REPRICE","MODEL_EDGE","SPREAD_CAPTURE","HEDGE","LOTTERY","MISTAKE_FIX"] },
  { name: "exit",          codes: ["THESIS_INVALIDATED","PROFIT_TAKE"] },
  { name: "process error", codes: ["BAD_RULE_READ","BAD_FACTS","BAD_MODEL","BAD_PRICE","BAD_SIZE","BAD_TIMING","BAD_EXIT","BAD_CORRELATION","ADVERSE_SELECTION"] },
  { name: "emotional",     codes: ["EMOTIONAL_TRADE","FOMO","REVENGE_TRADE"] },
  { name: "outcome",       codes: ["GOOD_PROCESS_BAD_RESULT","BAD_PROCESS_GOOD_RESULT"] },
  { name: "external",      codes: ["PLATFORM_OR_RESOLUTION_WEIRDNESS"] },
]

export const NAV = [
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
]

export function fmtPrice(v) {
  if (v == null) return "—"
  return `$${(+v).toFixed(3)}`
}
export function fmtMoney(v) {
  if (v == null) return "—"
  return `$${(+v).toFixed(2)}`
}
export function shortId(id, n = 12) {
  if (!id) return "—"
  return id.length <= n ? id : id.slice(0, n) + "…"
}
export function fmtTs(ts) {
  if (!ts) return "—"
  return String(ts).replace("T", " ").replace("Z", "")
}
