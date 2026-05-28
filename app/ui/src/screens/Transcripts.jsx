import { useState } from 'react'
import { api } from '../api.js'
import { Chip, Btn } from '../components.jsx'
import { ASSISTANTS } from '../constants.js'

export default function Transcripts({ go, onDone }) {
  const [stage, setStage] = useState('DROP')
  const [file, setFile] = useState(null)
  const [assistant, setAssistant] = useState('GPT')
  const [fmt, setFmt] = useState('plain')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const handleFile = (f) => {
    if (!f) return
    setFile(f)
    const detectedFmt = f.name.endsWith('.json') ? 'chatgpt_json' : 'plain'
    setFmt(detectedFmt)
    setError(null)
    setStage('PREVIEW')
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const commit = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const r = await api.importTranscript(file, assistant)
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
          <div className="h-comment">tabs[1] · import transcripts · transcript_import.import_transcript_text()</div>
          <div className="h-stat lg mt-1">IMPORT TRANSCRIPTS</div>
          <div className="dim mt-1" style={{ fontSize: 11 }}>
            chat exports → NEEDS_REVIEW attributions · plain (Human/Assistant, You/ChatGPT, User/Claude) or ChatGPT JSON · match by slug + title keywords
          </div>
        </div>
      </div>

      <div className="screen-body" style={{ padding: 24, overflowY: 'auto' }}>
        <div className="row gap-3 mb-4" style={{ fontSize: 11 }}>
          {[
            ['DROP', '1 · pick transcript + assistant'],
            ['PREVIEW', '2 · review before commit'],
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
              onClick={() => document.getElementById('transcript-input').click()}
              style={dragging ? { borderColor: 'var(--magenta)', boxShadow: 'inset 0 0 60px rgba(255,61,240,0.12)' } : undefined}
            >
              <input id="transcript-input" type="file" accept=".txt,.md,.json" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              <div className="h-stat" style={{ color: 'var(--text-1)' }}>⌄ drop transcript file</div>
              <div className="dim mt-2 mono" style={{ fontSize: 12 }}>accepted: .txt · .md · .json</div>
              <div className="div-dashed" style={{ width: '60%', margin: '20px auto' }} />
              <div className="dim" style={{ fontSize: 11, maxWidth: 540, margin: '0 auto' }}>
                plain-text labels recognized: <span className="mono">Human:</span> / <span className="mono">Assistant:</span> · <span className="mono">You:</span> / <span className="mono">ChatGPT:</span> · <span className="mono">User:</span> / <span className="mono">Claude:</span>
                <br />or paste the ChatGPT JSON export (<span className="mono">conversations.json</span>).
              </div>
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="col">
                <label className="in-label">assistant · ASSISTANTS enum</label>
                <select className="in" value={assistant} onChange={e => setAssistant(e.target.value)}>
                  {ASSISTANTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <div className="dim mono mt-1" style={{ fontSize: 10 }}>which assistant produced this transcript</div>
              </div>
              <div className="col">
                <label className="in-label">fmt · auto-detected</label>
                <select className="in" value={fmt} onChange={e => setFmt(e.target.value)}>
                  <option value="plain">plain</option>
                  <option value="chatgpt_json">chatgpt_json</option>
                </select>
                <div className="dim mono mt-1" style={{ fontSize: 10 }}>.json → chatgpt_json · else plain</div>
              </div>
            </div>
          </div>
        )}

        {stage === 'PREVIEW' && file && (
          <div className="col gap-4">
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="raw-block p-3">
                <div className="h-caps">source</div>
                <div className="mono mt-1" style={{ fontSize: 12 }}>{file.name}</div>
                <div className="dim mono mt-1" style={{ fontSize: 10 }}>fmt={fmt} · {(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <div className="raw-block p-3">
                <div className="h-caps">assistant</div>
                <div className="row gap-2 mt-1">
                  <Chip kind={assistant === 'GPT' ? 'gpt' : assistant === 'CLAUDE' ? 'claude' : 'draft'}>{assistant}</Chip>
                  <span className="dim mono" style={{ fontSize: 10 }}>· every created attribution carries this assistant</span>
                </div>
              </div>
            </div>

            <div className="panel p-3" style={{ borderLeft: '3px solid var(--amber)' }}>
              <div className="row gap-2">
                <span className="warn">⚠</span>
                <span className="warn mono" style={{ fontSize: 11 }}>nothing is auto-confirmed</span>
              </div>
              <div className="dim mt-2" style={{ fontSize: 11 }}>
                These rows will appear in the Attribution screen filtered to <span className="mono">NEEDS_REVIEW</span>. You confirm/reject each one. Raw trades are not touched.
              </div>
            </div>

            <div className="row gap-2">
              <Btn kind="primary" onClick={commit} disabled={loading}>
                {loading ? 'COMMITTING…' : '▶ COMMIT ATTRIBUTIONS'}
              </Btn>
              <Btn kind="ghost" onClick={reset}>CANCEL</Btn>
            </div>
          </div>
        )}

        {stage === 'DONE' && result && (
          <div className="panel p-4">
            <div className="h-comment mb-2">✓ transcript imported · TranscriptImportResult</div>
            <div className="h-stat pos">+{result.attributions_created ?? result.matches_found ?? 0} NEEDS_REVIEW attributions</div>
            <pre className="mono mt-3" style={{ fontSize: 11, background: 'var(--bg-1)', border: '1px solid var(--border-1)', padding: 12, color: 'var(--text-1)' }}>
{JSON.stringify(result, null, 2)}
            </pre>
            <div className="div-dashed mt-3 mb-3" />
            <div className="row gap-2">
              <Btn kind="primary" onClick={() => go('attribution')}>▶ REVIEW IN ATTRIBUTION QUEUE</Btn>
              <Btn kind="ghost" onClick={reset}>IMPORT ANOTHER</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
