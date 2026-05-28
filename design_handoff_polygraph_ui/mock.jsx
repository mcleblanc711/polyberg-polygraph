/* ============================================
   Polygraph — mock data
   Aligned to the real `ledger/` SQLite schema and enums.
   ============================================ */

/* ---------- ENUMS (mirror ledger/enums.py exactly) ---------- */
const PROJECTS = [
  "GEO_OIL",
  "ELECTIONS",
  "SPORTS_MM",
  "SPORTS_DIRECTIONAL",
  "EXPERIMENTAL",
  "CASH",
];

const SLEEVES = ["main", "scratch", "rules_lab"];

const ASSISTANTS = ["GPT", "CLAUDE", "GROK", "USER"];

const ATTRIBUTIONS = [
  "DIRECT_RECOMMENDATION",
  "SUPPORTED_AFTER_REVIEW",
  "OPPOSED",
  "MENTIONED_BUT_NOT_RECOMMENDED",
  "NO_MATCH_FOUND",
  "NOT_INVOLVED",
  "UNCLEAR",
];

const REVIEW_STATUSES = [
  "DRAFT",
  "MODEL_PROPOSED",
  "USER_CONFIRMED",
  "REJECTED",
  "NEEDS_REVIEW",
];

const DECISION_STATUSES = ["DRAFT", "OPEN", "RESOLVED_WIN", "RESOLVED_LOSS", "INVALIDATED"];

const REASON_ERROR_CODES = [
  // Setups / positive reasons
  "RULE_ARB", "CLEAN_ORACLE_NO", "HEADLINE_OVERSHOOT", "FAST_INFO_REPRICE",
  "MODEL_EDGE", "SPREAD_CAPTURE", "HEDGE", "LOTTERY", "MISTAKE_FIX",
  // Exit reasons
  "THESIS_INVALIDATED", "PROFIT_TAKE",
  // Process errors
  "BAD_RULE_READ", "BAD_FACTS", "BAD_MODEL", "BAD_PRICE", "BAD_SIZE",
  "BAD_TIMING", "BAD_EXIT", "BAD_CORRELATION", "ADVERSE_SELECTION",
  // Emotional
  "EMOTIONAL_TRADE", "FOMO", "REVENGE_TRADE",
  // Process vs result
  "GOOD_PROCESS_BAD_RESULT", "BAD_PROCESS_GOOD_RESULT",
  // External
  "PLATFORM_OR_RESOLUTION_WEIRDNESS",
];

// Buckets for the post-mortem chip picker
const REASON_GROUPS = [
  { name: "setup",    codes: ["RULE_ARB","CLEAN_ORACLE_NO","HEADLINE_OVERSHOOT","FAST_INFO_REPRICE","MODEL_EDGE","SPREAD_CAPTURE","HEDGE","LOTTERY","MISTAKE_FIX"] },
  { name: "exit",     codes: ["THESIS_INVALIDATED","PROFIT_TAKE"] },
  { name: "process error", codes: ["BAD_RULE_READ","BAD_FACTS","BAD_MODEL","BAD_PRICE","BAD_SIZE","BAD_TIMING","BAD_EXIT","BAD_CORRELATION","ADVERSE_SELECTION"] },
  { name: "emotional",codes: ["EMOTIONAL_TRADE","FOMO","REVENGE_TRADE"] },
  { name: "outcome",  codes: ["GOOD_PROCESS_BAD_RESULT","BAD_PROCESS_GOOD_RESULT"] },
  { name: "external", codes: ["PLATFORM_OR_RESOLUTION_WEIRDNESS"] },
];

const QUALITY_VALUES = ["EXCELLENT", "GOOD", "OK", "POOR", "BAD"];

/* ---------- MARKETS (composite of slug + title; what Polymarket exports do) ---------- */
const MARKETS = [
  { slug: "hormuz-normal-end-june-2026",  title: "Hormuz remains operationally normal through June 2026" },
  { slug: "fed-cuts-rates-december-2026", title: "Fed cuts rates at December 2026 FOMC" },
  { slug: "fed-cuts-rates-september-2026",title: "Fed cuts rates at September 2026 FOMC" },
  { slug: "labour-wins-uk-general-2026",  title: "Labour wins UK General Election 2026" },
  { slug: "btc-above-100k-eoy-2026",      title: "BTC above $100k on 2026-12-31" },
  { slug: "scotus-strikes-chevron-term",  title: "SCOTUS overrules Chevron deference this term" },
  { slug: "nba-celtics-win-finals-2026",  title: "Celtics win the 2026 NBA Finals" },
  { slug: "nfl-chiefs-make-superbowl",    title: "Chiefs make Super Bowl LX" },
  { slug: "us-cpi-may-above-3pct",        title: "US May 2026 CPI YoY above 3.0%" },
];

/* ---------- TRADES (raw fills — append-only) ----------
   Schema mirrors trades_raw:
     trade_id PK · source_row_hash UNIQUE · imported_at · source_file · timestamp
     market_slug · market_title · outcome · side · action
     price · shares · notional · fees · raw_json
*/
function mkTrade(i, ts, projectHint, marketSlug, side, action, outcome, price, shares, opts = {}) {
  const market = MARKETS.find(m => m.slug === marketSlug);
  const notional = +(price * shares).toFixed(2);
  return {
    trade_id: `trd_${(0x9f3e + i).toString(16)}`,
    source_row_hash: `${(Math.random().toString(16).slice(2, 18))}`,
    imported_at: opts.imported_at || "2026-05-22T22:14:03Z",
    source_file: opts.source_file || "polymarket_export_2026-05-22.csv",
    timestamp: ts,
    market_slug: marketSlug,
    market_title: market?.title ?? "unknown market",
    outcome,
    side,
    action,
    price,
    shares,
    notional,
    fees: +(notional * 0.002).toFixed(4),
    _project_hint: projectHint, // not in schema — only used to seed sample data
  };
}

const TRADES = [
  // GEO_OIL · Hormuz
  mkTrade( 1, "2026-05-22T14:03:11Z", "GEO_OIL",       "hormuz-normal-end-june-2026",   "BUY",  "TRADE", "No",  0.36, 127.789),
  mkTrade( 2, "2026-05-22T14:05:42Z", "GEO_OIL",       "hormuz-normal-end-june-2026",   "BUY",  "TRADE", "No",  0.35,  82.401),
  mkTrade( 9, "2026-05-14T18:45:00Z", "GEO_OIL",       "hormuz-normal-end-june-2026",   "SELL", "TRADE", "No",  0.41,  20.000),
  mkTrade(13, "2026-05-10T16:32:11Z", "GEO_OIL",       "hormuz-normal-end-june-2026",   "BUY",  "TRADE", "No",  0.39,  60.000),
  // ELECTIONS · UK
  mkTrade( 5, "2026-05-17T09:30:12Z", "ELECTIONS",     "labour-wins-uk-general-2026",   "BUY",  "TRADE", "Yes", 0.78, 150.000),
  mkTrade(12, "2026-05-11T08:55:30Z", "ELECTIONS",     "labour-wins-uk-general-2026",   "SELL", "TRADE", "Yes", 0.81,  50.000),
  // EXPERIMENTAL · Fed dec
  mkTrade( 3, "2026-05-19T10:11:08Z", "EXPERIMENTAL",  "fed-cuts-rates-december-2026",  "SELL", "TRADE", "Yes", 0.62, 200.000),
  mkTrade(10, "2026-05-13T12:18:22Z", "EXPERIMENTAL",  "fed-cuts-rates-december-2026",  "BUY",  "TRADE", "No",  0.38, 180.000),
  mkTrade(11, "2026-05-12T21:09:44Z", "EXPERIMENTAL",  "fed-cuts-rates-december-2026",  "BUY",  "TRADE", "No",  0.39, 120.000),
  // EXPERIMENTAL · Fed sept
  mkTrade( 4, "2026-05-18T22:47:33Z", "EXPERIMENTAL",  "fed-cuts-rates-september-2026", "BUY",  "TRADE", "Yes", 0.41, 350.000),
  // EXPERIMENTAL · BTC
  mkTrade( 6, "2026-05-16T15:22:00Z", "EXPERIMENTAL",  "btc-above-100k-eoy-2026",       "BUY",  "TRADE", "Yes", 0.58,  90.000),
  mkTrade( 7, "2026-05-16T15:24:18Z", "EXPERIMENTAL",  "btc-above-100k-eoy-2026",       "BUY",  "TRADE", "Yes", 0.57, 110.000),
  // EXPERIMENTAL · SCOTUS
  mkTrade( 8, "2026-05-15T11:01:51Z", "EXPERIMENTAL",  "scotus-strikes-chevron-term",   "BUY",  "TRADE", "No",  0.44,  75.000),
  mkTrade(14, "2026-05-09T14:14:14Z", "EXPERIMENTAL",  "scotus-strikes-chevron-term",   "BUY",  "TRADE", "No",  0.42,  40.000),
  // SPORTS_MM · spread capture
  mkTrade(15, "2026-05-20T18:30:00Z", "SPORTS_MM",     "nba-celtics-win-finals-2026",   "BUY",  "TRADE", "Yes", 0.48,  40.000),
  mkTrade(16, "2026-05-20T18:31:14Z", "SPORTS_MM",     "nba-celtics-win-finals-2026",   "SELL", "TRADE", "Yes", 0.51,  40.000),
  // SPORTS_DIRECTIONAL
  mkTrade(17, "2026-05-08T20:10:00Z", "SPORTS_DIRECTIONAL", "nfl-chiefs-make-superbowl","BUY",  "TRADE", "Yes", 0.34,  60.000),
  // CASH · redemption
  mkTrade(18, "2026-05-21T11:00:00Z", "CASH",          "us-cpi-may-above-3pct",         "SELL", "REDEMPTION", "Yes", 1.00, 80.000),
];

/* ---------- DECISIONS (rich — match real schema) ---------- */
const DECISIONS = [
  {
    decision_id: "dec_8f3e29a01b1c01a8",
    decision_timestamp: "2026-05-22T13:50:00Z",
    project: "GEO_OIL",
    sleeve: "main",
    market_slug: "hormuz-normal-end-june-2026",
    market_title: "Hormuz remains operationally normal through June 2026",
    outcome: "No",
    side: "BUY",
    intent: "OPEN_POSITION",
    decision_type: "RULE_FOLLOW",
    price_used: 0.36,
    target_entry: "0.34–0.38",
    target_exit: "0.18 or June 30 resolution",
    max_allocation: 0.30,
    thesis_summary: "Headline tone is hawkish but IMF Portwatch shows throughput steady at 18.2M bbl/d. Market is pricing headline risk, not mechanical disruption.",
    rule_summary: "Resolves via IMF Portwatch — judge by Portwatch mechanics, not wires. Avoid sell ladders at 99c (dispute tax).",
    catalyst: "OPEC+ June 5; Iran NPT signal mid-June.",
    invalidation: "Portwatch 7d throughput below 14M bbl/d for 3 consecutive days, or a US-Iran kinetic incident.",
    user_notes: "Sized smaller than usual — too much headline noise.",
    status: "OPEN",
  },
  {
    decision_id: "dec_a91f12c734abc402",
    decision_timestamp: "2026-05-19T09:42:00Z",
    project: "EXPERIMENTAL",
    sleeve: "rules_lab",
    market_slug: "fed-cuts-rates-december-2026",
    market_title: "Fed cuts rates at December 2026 FOMC",
    outcome: "Yes",
    side: "SELL",
    intent: "OPEN_POSITION",
    decision_type: "MODEL_EDGE",
    price_used: 0.62,
    target_entry: "0.60–0.64",
    target_exit: "0.40 or post-FOMC re-pricing",
    max_allocation: 0.05,
    thesis_summary: "Market overweights December cut probability. Dot-plot dispersion suggests 0.38 implied; current 0.62 is rich.",
    rule_summary: "Sell rich gov-policy markets when implied > 1.4× model. Size 5% NAV max.",
    catalyst: "FOMC July 30 + Jackson Hole.",
    invalidation: "Two consecutive sub-trend CPI prints.",
    user_notes: "",
    status: "RESOLVED_WIN",
  },
  {
    decision_id: "dec_b022f8e6411dd0c1",
    decision_timestamp: "2026-05-18T22:30:00Z",
    project: "EXPERIMENTAL",
    sleeve: "rules_lab",
    market_slug: "fed-cuts-rates-september-2026",
    market_title: "Fed cuts rates at September 2026 FOMC",
    outcome: "Yes",
    side: "BUY",
    intent: "OPEN_POSITION",
    decision_type: "MODEL_EDGE",
    price_used: 0.41,
    target_entry: "0.38–0.43",
    target_exit: "0.65 or pre-FOMC drift",
    max_allocation: 0.06,
    thesis_summary: "September cut underpriced given labor cooling. Jobless claims trend cross-checked manually.",
    rule_summary: "Buy underpriced gov-policy when implied < 0.7× model and catalyst within 60d.",
    catalyst: "Aug CPI, Aug NFP.",
    invalidation: "Core PCE re-acceleration above 3%.",
    user_notes: "",
    status: "RESOLVED_WIN",
  },
  {
    decision_id: "dec_c4517a2dd9b62200",
    decision_timestamp: "2026-05-17T09:15:00Z",
    project: "ELECTIONS",
    sleeve: "main",
    market_slug: "labour-wins-uk-general-2026",
    market_title: "Labour wins UK General Election 2026",
    outcome: "Yes",
    side: "BUY",
    intent: "OPEN_POSITION",
    decision_type: "RULE_FOLLOW",
    price_used: 0.78,
    target_entry: "0.76–0.80",
    target_exit: "0.95+ or election night",
    max_allocation: 0.20,
    thesis_summary: "Polling lead stable at 18–20pts across 4 pollsters. Bayesian aggregation suggests 0.88. Buying yes at 0.78 is +10pts edge.",
    rule_summary: "Election markets: edge > 8pts only.",
    catalyst: "Election Day.",
    invalidation: "YouGov MRP shifts below 12pt lead.",
    user_notes: "",
    status: "OPEN",
  },
  {
    decision_id: "dec_d8eee03f4b6f99aa",
    decision_timestamp: "2026-05-15T10:48:00Z",
    project: "EXPERIMENTAL",
    sleeve: "scratch",
    market_slug: "scotus-strikes-chevron-term",
    market_title: "SCOTUS overrules Chevron deference this term",
    outcome: "No",
    side: "BUY",
    intent: "OPEN_POSITION",
    decision_type: "READ_ON_PROCEDURE",
    price_used: 0.43,
    target_entry: "0.40–0.46",
    target_exit: "term close",
    max_allocation: 0.04,
    thesis_summary: "Court signals erosion but full strike unlikely this term. Buying NO at 0.43.",
    rule_summary: "SCOTUS markets — buy NO on procedural-friction reads.",
    catalyst: "End of term decisions.",
    invalidation: "Oral argument explicit majority signal.",
    user_notes: "",
    status: "RESOLVED_WIN",
  },
  {
    decision_id: "dec_e1129c447aa01f33",
    decision_timestamp: "2026-05-20T18:25:00Z",
    project: "SPORTS_MM",
    sleeve: "main",
    market_slug: "nba-celtics-win-finals-2026",
    market_title: "Celtics win the 2026 NBA Finals",
    outcome: "Yes",
    side: "BUY",
    intent: "MARKET_MAKE",
    decision_type: "SPREAD_CAPTURE",
    price_used: 0.495,
    target_entry: "0.47–0.52",
    target_exit: "spread close < 1¢ or end of finals",
    max_allocation: 0.10,
    thesis_summary: "Spread-capture pair on Celtics market — pay 0.48 yes, sell 0.51 yes within ~5 minutes.",
    rule_summary: "Sports MM: only quote when book spread > 2¢ and depth > $200.",
    catalyst: "Game 3 tipoff.",
    invalidation: "Spread compresses below 1¢ before fill.",
    user_notes: "Filled both legs cleanly.",
    status: "RESOLVED_WIN",
  },
];

/* ---------- LINKS (trade_decision_links) ---------- */
const LINKS = [
  { trade_id: "trd_9f3f", decision_id: "dec_8f3e29a01b1c01a8", link_confidence: 1.0, link_method: "USER", created_at: "2026-05-22T14:08:47Z" },
  { trade_id: "trd_9f40", decision_id: "dec_8f3e29a01b1c01a8", link_confidence: 1.0, link_method: "USER", created_at: "2026-05-22T14:08:47Z" },
  { trade_id: "trd_9f47", decision_id: "dec_8f3e29a01b1c01a8", link_confidence: 0.92, link_method: "USER", created_at: "2026-05-14T18:51:00Z" },
  { trade_id: "trd_9f41", decision_id: "dec_a91f12c734abc402", link_confidence: 1.0, link_method: "USER", created_at: "2026-05-19T10:14:11Z" },
  { trade_id: "trd_9f42", decision_id: "dec_b022f8e6411dd0c1", link_confidence: 1.0, link_method: "USER", created_at: "2026-05-18T22:48:55Z" },
  { trade_id: "trd_9f43", decision_id: "dec_c4517a2dd9b62200", link_confidence: 1.0, link_method: "USER", created_at: "2026-05-17T09:31:20Z" },
  { trade_id: "trd_9f4a", decision_id: "dec_c4517a2dd9b62200", link_confidence: 0.85, link_method: "USER", created_at: "2026-05-11T09:00:00Z" },
  { trade_id: "trd_9f46", decision_id: "dec_d8eee03f4b6f99aa", link_confidence: 1.0, link_method: "USER", created_at: "2026-05-15T11:02:30Z" },
  { trade_id: "trd_9f4c", decision_id: "dec_d8eee03f4b6f99aa", link_confidence: 0.78, link_method: "USER", created_at: "2026-05-09T14:20:00Z" },
  { trade_id: "trd_9f4d", decision_id: "dec_e1129c447aa01f33", link_confidence: 1.0, link_method: "USER", created_at: "2026-05-20T18:33:00Z" },
  { trade_id: "trd_9f4e", decision_id: "dec_e1129c447aa01f33", link_confidence: 1.0, link_method: "USER", created_at: "2026-05-20T18:33:00Z" },
];

/* ---------- ASSISTANT ATTRIBUTIONS (the real assistant_attributions table) ---------- */
const ATTRIBUTIONS_ROWS = [
  // Hormuz · dec_8f3e29a01b1c01a8 — confirmed
  { attribution_id: "att_0001a8b2c3", trade_id: null, decision_id: "dec_8f3e29a01b1c01a8",
    assistant: "GPT",    attribution: "DIRECT_RECOMMENDATION", evidence: '"Yes — buy NO at 0.36-0.38. Portwatch data are decisive. Cap exposure at 30% NAV."',
    evidence_source: "chat_2026-05-22_oil_hormuz.md#L41-L82", recommended_price: 0.37, recommended_size: 0.30,
    match_quality: 0.92, review_status: "USER_CONFIRMED", created_at: "2026-05-22T13:55:30Z" },
  { attribution_id: "att_0002c3d4e5", trade_id: null, decision_id: "dec_8f3e29a01b1c01a8",
    assistant: "CLAUDE", attribution: "SUPPORTED_AFTER_REVIEW", evidence: '"Your read is consistent with the throughput series. The headline-vs-mechanics distinction is the key one."',
    evidence_source: "claude_thread_PVMxx.md#final-turn", recommended_price: null, recommended_size: null,
    match_quality: 0.88, review_status: "USER_CONFIRMED", created_at: "2026-05-22T13:55:31Z" },
  { attribution_id: "att_0003f5a6b7", trade_id: null, decision_id: "dec_8f3e29a01b1c01a8",
    assistant: "GROK",   attribution: "NOT_INVOLVED", evidence: "", evidence_source: "",
    recommended_price: null, recommended_size: null, match_quality: 1.0, review_status: "USER_CONFIRMED",
    created_at: "2026-05-22T13:55:32Z" },

  // Fed dec · dec_a91f12c734abc402
  { attribution_id: "att_0004b7c8d9", trade_id: null, decision_id: "dec_a91f12c734abc402",
    assistant: "GPT",    attribution: "OPPOSED",
    evidence: '"I think December is more likely than market implies. I would not fade this."',
    evidence_source: "chat_2026-05-19_fed_decompress.md#L120-L145", recommended_price: null, recommended_size: null,
    match_quality: 0.81, review_status: "USER_CONFIRMED", created_at: "2026-05-19T09:46:00Z" },
  { attribution_id: "att_0005d9e0f1", trade_id: null, decision_id: "dec_a91f12c734abc402",
    assistant: "CLAUDE", attribution: "DIRECT_RECOMMENDATION",
    evidence: '"Yes — selling at 0.62 looks correct. Dispersion in dot plots suggests ~0.40."',
    evidence_source: "claude_thread_FedDec.md#L88-L107", recommended_price: 0.62, recommended_size: 0.05,
    match_quality: 0.94, review_status: "USER_CONFIRMED", created_at: "2026-05-19T09:46:30Z" },

  // Fed sept · dec_b022f8e6411dd0c1
  { attribution_id: "att_0006f1a2b3", trade_id: null, decision_id: "dec_b022f8e6411dd0c1",
    assistant: "GPT",    attribution: "SUPPORTED_AFTER_REVIEW",
    evidence: '"Labor cooling argument holds. Buying at 0.41 is defensible."',
    evidence_source: "chat_2026-05-18_fed_sept.md#L51-L77", recommended_price: 0.41, recommended_size: null,
    match_quality: 0.79, review_status: "USER_CONFIRMED", created_at: "2026-05-18T22:55:00Z" },
  { attribution_id: "att_0007b3c4d5", trade_id: null, decision_id: "dec_b022f8e6411dd0c1",
    assistant: "CLAUDE", attribution: "NO_MATCH_FOUND",
    evidence: "Conversation history searched 2026-05-15 through 2026-05-18. No discussion of September FOMC found.",
    evidence_source: "claude_export_2026-05-22/", recommended_price: null, recommended_size: null,
    match_quality: 1.0, review_status: "USER_CONFIRMED", created_at: "2026-05-18T22:55:30Z" },

  // UK election · dec_c4517a2dd9b62200
  { attribution_id: "att_0008d5e6f7", trade_id: null, decision_id: "dec_c4517a2dd9b62200",
    assistant: "GPT",    attribution: "NOT_INVOLVED", evidence: "", evidence_source: "",
    recommended_price: null, recommended_size: null, match_quality: 1.0, review_status: "USER_CONFIRMED",
    created_at: "2026-05-17T09:35:00Z" },
  { attribution_id: "att_0009f7a8b9", trade_id: null, decision_id: "dec_c4517a2dd9b62200",
    assistant: "CLAUDE", attribution: "NOT_INVOLVED", evidence: "", evidence_source: "",
    recommended_price: null, recommended_size: null, match_quality: 1.0, review_status: "USER_CONFIRMED",
    created_at: "2026-05-17T09:35:00Z" },

  // SCOTUS · dec_d8eee03f4b6f99aa
  { attribution_id: "att_0010b9c0d1", trade_id: null, decision_id: "dec_d8eee03f4b6f99aa",
    assistant: "GPT",    attribution: "MENTIONED_BUT_NOT_RECOMMENDED",
    evidence: '"Chevron came up in a separate macro thread; no specific call was made on this market."',
    evidence_source: "chat_2026-05-15_macro_misc.md#L300-L312", recommended_price: null, recommended_size: null,
    match_quality: 0.55, review_status: "NEEDS_REVIEW", created_at: "2026-05-15T10:55:00Z" },
  { attribution_id: "att_0011d1e2f3", trade_id: null, decision_id: "dec_d8eee03f4b6f99aa",
    assistant: "CLAUDE", attribution: "UNCLEAR",
    evidence: '"Discussed administrative law trajectory; unclear whether this counts as a recommendation."',
    evidence_source: "claude_thread_AdminLaw.md#middle", recommended_price: null, recommended_size: null,
    match_quality: 0.42, review_status: "NEEDS_REVIEW", created_at: "2026-05-15T10:55:15Z" },

  // Transcript-sourced rows for unlinked clusters → trade-level NEEDS_REVIEW
  { attribution_id: "att_0012f3a4b5", trade_id: "trd_9f44", decision_id: null,
    assistant: "GPT",    attribution: "DIRECT_RECOMMENDATION",
    evidence: '"BTC over $100k is a high-conviction yes at anything below 0.62 for me."',
    evidence_source: "chatgpt_export_2026-05-22.json#conv_btc_2026-05-16", recommended_price: 0.60, recommended_size: null,
    match_quality: 0.72, review_status: "NEEDS_REVIEW", created_at: "2026-05-22T22:14:10Z" },
  { attribution_id: "att_0013b5c6d7", trade_id: "trd_9f45", decision_id: null,
    assistant: "GPT",    attribution: "DIRECT_RECOMMENDATION",
    evidence: '"Same as before — yes at sub-0.60 still fine."',
    evidence_source: "chatgpt_export_2026-05-22.json#conv_btc_2026-05-16", recommended_price: 0.58, recommended_size: null,
    match_quality: 0.68, review_status: "NEEDS_REVIEW", created_at: "2026-05-22T22:14:11Z" },
];

/* ---------- POSTMORTEMS (rich — match real postmortems table) ---------- */
const POSTMORTEMS = [
  {
    postmortem_id: "pm_001a2b3c4d",
    decision_id: "dec_a91f12c734abc402",
    created_at: "2026-05-19T18:00:00Z",
    pnl: 12.40,
    thesis_quality: "GOOD",
    execution_quality: "GOOD",
    sizing_quality: "OK",
    exit_quality: "EXCELLENT",
    rule_read_quality: "GOOD",
    primary_error_type: "GOOD_PROCESS_BAD_RESULT",
    secondary_error_type: "",
    what_went_right: "Held discipline on size. Took target_exit signal as soon as dot-plot dispersion narrowed.",
    what_went_wrong: "Could have entered earlier; I let the headline noise scare me down to half-size.",
    lesson_keep: "Trust the model when implied > 1.4× model. The signal worked.",
    lesson_change: "Pre-commit to size with a written ticket so headline shocks don't shrink the position.",
    never_repeat: "",
    future_rule: "Gov-policy fade: ticket size 24h before entry; do not adjust on intra-day headlines.",
    markdown_body: "",
  },
  {
    postmortem_id: "pm_002e5f6a7b",
    decision_id: "dec_b022f8e6411dd0c1",
    created_at: "2026-05-18T23:30:00Z",
    pnl: 18.50,
    thesis_quality: "EXCELLENT",
    execution_quality: "GOOD",
    sizing_quality: "GOOD",
    exit_quality: "GOOD",
    rule_read_quality: "EXCELLENT",
    primary_error_type: "MODEL_EDGE",
    secondary_error_type: "",
    what_went_right: "Underpriced gov-policy rule fired clean. NFP confirmed within 48h. Pre-set exit at 0.65 was hit.",
    what_went_wrong: "Nothing material.",
    lesson_keep: "Cross-checking jobless claims trend manually was worth the time.",
    lesson_change: "",
    never_repeat: "",
    future_rule: "",
    markdown_body: "",
  },
  {
    postmortem_id: "pm_003c7d8e9f",
    decision_id: "dec_d8eee03f4b6f99aa",
    created_at: "2026-05-15T19:00:00Z",
    pnl: 3.10,
    thesis_quality: "OK",
    execution_quality: "OK",
    sizing_quality: "GOOD",
    exit_quality: "OK",
    rule_read_quality: "GOOD",
    primary_error_type: "BAD_PROCESS_GOOD_RESULT",
    secondary_error_type: "ADVERSE_SELECTION",
    what_went_right: "Position resolved profitably.",
    what_went_wrong: "I didn't actually verify the oral-argument transcripts; got lucky on procedural read.",
    lesson_keep: "Buying NO on procedural-friction reads is a working setup.",
    lesson_change: "Always pull and skim the oral-argument transcript before sizing.",
    never_repeat: "Skipping the source material on SCOTUS markets.",
    future_rule: "SCOTUS markets: cap size to 2% NAV until oral-argument transcript reviewed.",
    markdown_body: "",
  },
  {
    postmortem_id: "pm_004g0h1i2j",
    decision_id: "dec_e1129c447aa01f33",
    created_at: "2026-05-20T19:00:00Z",
    pnl: 0.41,
    thesis_quality: "GOOD",
    execution_quality: "EXCELLENT",
    sizing_quality: "OK",
    exit_quality: "EXCELLENT",
    rule_read_quality: "GOOD",
    primary_error_type: "SPREAD_CAPTURE",
    secondary_error_type: "",
    what_went_right: "Spread compressed inside 5 min; both legs filled.",
    what_went_wrong: "Could have quoted at depth — left ~40bps of edge on the table.",
    lesson_keep: "Sports MM at >2¢ spreads with depth > $200 keeps working.",
    lesson_change: "Add tier-2 quote at depth = 0.5× book depth.",
    never_repeat: "",
    future_rule: "",
    markdown_body: "",
  },
];

/* ---------- IMPORTS (recent CSV runs) ---------- */
const IMPORTS = [
  { imported_at: "2026-05-22T22:14:03Z", source_file: "polymarket_export_2026-05-22.csv", rows_seen: 142, rows_imported: 14, duplicates_skipped: 128, errors: 0 },
  { imported_at: "2026-05-19T09:01:18Z", source_file: "polymarket_export_2026-05-19.csv", rows_seen: 128, rows_imported:  9, duplicates_skipped: 119, errors: 0 },
  { imported_at: "2026-05-15T11:47:22Z", source_file: "polymarket_export_2026-05-15.csv", rows_seen: 119, rows_imported: 23, duplicates_skipped:  94, errors: 2 },
  { imported_at: "2026-05-10T14:32:00Z", source_file: "polymarket_export_2026-05-10.csv", rows_seen:  96, rows_imported: 17, duplicates_skipped:  79, errors: 0 },
];

/* ---------- TRANSCRIPT RUNS (Import Transcripts tab) ---------- */
const TRANSCRIPT_RUNS = [
  {
    run_id: "tr_run_001",
    imported_at: "2026-05-22T22:18:00Z",
    source_file: "chatgpt_export_2026-05-22.json",
    fmt: "chatgpt_json",
    assistant: "GPT",
    turns_parsed: 412,
    assistant_turns: 196,
    matches_found: 14,
    attributions_created: 11,
    duplicates_skipped: 3,
    errors: 0,
  },
  {
    run_id: "tr_run_002",
    imported_at: "2026-05-22T22:25:00Z",
    source_file: "claude_thread_PVMxx.md",
    fmt: "plain",
    assistant: "CLAUDE",
    turns_parsed: 38,
    assistant_turns: 19,
    matches_found: 4,
    attributions_created: 4,
    duplicates_skipped: 0,
    errors: 0,
  },
];

/* ---------- SHEETS EXPORT HISTORY ---------- */
const SHEETS_RUNS = [
  {
    run_id: "sh_001",
    exported_at: "2026-05-22T22:30:00Z",
    spreadsheet_id: "1aBcD3F4gHiJ5KlMnOpQrStUvWxYz_polygraph",
    spreadsheet_name: "polygraph · ledger",
    counts: { Trades: 18, Decisions: 6, Attributions: 13, Postmortems: 4 },
    user: "USER",
  },
  {
    run_id: "sh_002",
    exported_at: "2026-05-19T18:05:00Z",
    spreadsheet_id: "1aBcD3F4gHiJ5KlMnOpQrStUvWxYz_polygraph",
    spreadsheet_name: "polygraph · ledger",
    counts: { Trades: 9, Decisions: 5, Attributions: 9, Postmortems: 2 },
    user: "USER",
  },
];

/* ---------- OPERATIONS LOG (display tail of writes — not a hashed audit chain) ---------- */
const OPS_LOG = [
  { ts: "2026-05-22T22:30:00Z", actor: "USER",   text: "EXPORT_TO_SHEETS · 4 worksheets overwritten", level: "info" },
  { ts: "2026-05-22T22:25:00Z", actor: "USER",   text: "IMPORT_TRANSCRIPT claude_thread_PVMxx.md · +4 NEEDS_REVIEW attributions", level: "info" },
  { ts: "2026-05-22T22:18:00Z", actor: "USER",   text: "IMPORT_TRANSCRIPT chatgpt_export_2026-05-22.json · +11 NEEDS_REVIEW", level: "info" },
  { ts: "2026-05-22T22:14:03Z", actor: "USER",   text: "IMPORT_CSV polymarket_export_2026-05-22.csv · +14 fills",   level: "info" },
  { ts: "2026-05-22T14:08:47Z", actor: "USER",   text: "LINK trd_9f3f, trd_9f40 → dec_8f3e29a0…",  level: "info" },
  { ts: "2026-05-22T14:08:12Z", actor: "USER",   text: "CREATE dec_8f3e29a0… (GEO_OIL · main)",   level: "info" },
  { ts: "2026-05-22T13:55:31Z", actor: "USER",   text: "ATTRIBUTE dec_8f3e29a0… GPT=DIRECT_RECOMMENDATION (USER_CONFIRMED)", level: "info" },
  { ts: "2026-05-19T18:00:00Z", actor: "USER",   text: "POSTMORTEM dec_a91f12c7… → +$12.40, MODEL_EDGE",  level: "info" },
  { ts: "2026-05-18T23:00:12Z", actor: "USER",   text: "REJECT attribution proposal att_0010b9c0d1", level: "warn" },
];

/* ============================================
   Helpers
   ============================================ */
function fmtMoney(n) {
  if (n == null) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}
function fmtPrice(n) { return `${(n * 100).toFixed(1)}¢`; }
function fmtPct(n) { return `${Math.round(n * 100)}%`; }
function shortId(id, prefix = 7) { return id.slice(0, prefix) + "…"; }

function tradeProject(t) {
  // resolve a trade's project via its linked decision; fall back to seed hint
  const link = LINKS.find(l => l.trade_id === t.trade_id);
  if (link) {
    const dec = DECISIONS.find(d => d.decision_id === link.decision_id);
    if (dec) return dec.project;
  }
  return t._project_hint || null;
}
function tradeSleeve(t) {
  const link = LINKS.find(l => l.trade_id === t.trade_id);
  if (link) {
    const dec = DECISIONS.find(d => d.decision_id === link.decision_id);
    if (dec) return dec.sleeve;
  }
  return null;
}
function tradeLinkedDecisionIds(t) {
  return LINKS.filter(l => l.trade_id === t.trade_id).map(l => l.decision_id);
}
function decisionLinkedTrades(decisionId) {
  const ids = LINKS.filter(l => l.decision_id === decisionId).map(l => l.trade_id);
  return TRADES.filter(t => ids.includes(t.trade_id));
}
function isLinked(t) { return LINKS.some(l => l.trade_id === t.trade_id); }
function unlinkedTrades() { return TRADES.filter(t => !isLinked(t)); }
function linkedTrades()   { return TRADES.filter(t =>  isLinked(t)); }
function decisionById(id) { return DECISIONS.find(d => d.decision_id === id); }
function marketBySlug(slug) { return MARKETS.find(m => m.slug === slug); }
function postmortemForDecision(id) { return POSTMORTEMS.find(p => p.decision_id === id); }
function attributionsForTrade(id)    { return ATTRIBUTIONS_ROWS.filter(a => a.trade_id === id); }
function attributionsForDecision(id) { return ATTRIBUTIONS_ROWS.filter(a => a.decision_id === id); }

function totalPnL() { return POSTMORTEMS.reduce((s, p) => s + (p.pnl || 0), 0); }

function projectPnL() {
  const out = {};
  PROJECTS.forEach(p => { out[p] = { pnl: 0, decisions: 0, fills: 0 }; });
  DECISIONS.forEach(d => {
    out[d.project].decisions += 1;
    out[d.project].fills += decisionLinkedTrades(d.decision_id).length;
    const pm = postmortemForDecision(d.decision_id);
    if (pm && pm.pnl != null) out[d.project].pnl += pm.pnl;
  });
  return out;
}

function counts() {
  return {
    trades: TRADES.length,
    unlinked: unlinkedTrades().length,
    decisions: DECISIONS.length,
    open: DECISIONS.filter(d => d.status === "OPEN" || d.status === "DRAFT").length,
    postmortems: POSTMORTEMS.length,
    pendingPM: DECISIONS.filter(d => (d.status === "RESOLVED_WIN" || d.status === "RESOLVED_LOSS" || d.status === "INVALIDATED") && !postmortemForDecision(d.decision_id)).length,
    attributions: ATTRIBUTIONS_ROWS.length,
    needsReview: ATTRIBUTIONS_ROWS.filter(a => a.review_status === "NEEDS_REVIEW").length,
    confirmed:   ATTRIBUTIONS_ROWS.filter(a => a.review_status === "USER_CONFIRMED").length,
    proposed:    ATTRIBUTIONS_ROWS.filter(a => a.review_status === "MODEL_PROPOSED").length,
  };
}

window.MOCK = {
  // enums
  PROJECTS, SLEEVES, ASSISTANTS, ATTRIBUTIONS, REVIEW_STATUSES, DECISION_STATUSES,
  REASON_ERROR_CODES, REASON_GROUPS, QUALITY_VALUES,
  // tables
  MARKETS, TRADES, DECISIONS, LINKS, ATTRIBUTIONS_ROWS, POSTMORTEMS,
  IMPORTS, TRANSCRIPT_RUNS, SHEETS_RUNS, OPS_LOG,
};

window.MOCK_HELPERS = {
  fmtMoney, fmtPrice, fmtPct, shortId,
  tradeProject, tradeSleeve, tradeLinkedDecisionIds, decisionLinkedTrades,
  isLinked, unlinkedTrades, linkedTrades,
  decisionById, marketBySlug, postmortemForDecision,
  attributionsForTrade, attributionsForDecision,
  totalPnL, projectPnL, counts,
};
