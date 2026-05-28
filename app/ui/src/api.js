const BASE = '/api'

async function apiFetch(path, options = {}) {
  const res = await fetch(BASE + path, options)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

function qs(params) {
  const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  return Object.keys(p).length ? '?' + new URLSearchParams(p) : ''
}

export const api = {
  status: () => apiFetch('/status'),

  trades: (params = {}) => apiFetch('/trades' + qs(params)),
  unlinkedTrades: () => apiFetch('/trades/unlinked'),
  groups: () => apiFetch('/trades/groups'),
  linkTrades: (body) => apiFetch('/trades/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),

  decisions: () => apiFetch('/decisions'),
  decision: (id) => apiFetch(`/decisions/${id}`),
  decisionTrades: (id) => apiFetch(`/decisions/${id}/trades`),
  createDecision: (body) => apiFetch('/decisions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  editDecision: (id, body) => apiFetch(`/decisions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),

  attributions: () => apiFetch('/attributions'),
  attributionsByTrade: (id) => apiFetch(`/attributions/trade/${id}`),
  attributionsByDecision: (id) => apiFetch(`/attributions/decision/${id}`),
  addAttribution: (body) => apiFetch('/attributions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  updateReviewStatus: (id, review_status) => apiFetch(`/attributions/${id}/review-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_status }),
  }),

  postmortems: () => apiFetch('/postmortems'),
  upsertPostmortem: (decision_id, body) => apiFetch(`/postmortems/${decision_id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),

  importCsv: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiFetch('/import/csv', { method: 'POST', body: fd })
  },
  importTranscript: (file, assistant) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('assistant', assistant)
    return apiFetch('/import/transcript', { method: 'POST', body: fd })
  },

  attributionPacket: (body) => apiFetch('/export/attribution-packet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  postmortemPacket: (decision_id) => apiFetch(`/export/postmortem-packet/${decision_id}`, { method: 'POST' }),
  exportSheets: (body) => apiFetch('/export/sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  attributionPrompt: (days_back = 30) => apiFetch(`/export/attribution-prompt?days_back=${days_back}`),
}
