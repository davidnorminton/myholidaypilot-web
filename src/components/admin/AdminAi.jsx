import { useEffect, useState } from 'react'
import { Save, Check, RefreshCw, KeyRound, Sparkles } from 'lucide-react'
import { api } from '../../lib/api.js'

// AI configuration: the Anthropic API key (stored server-side, returned only
// masked) and the model to use — fetched live from the API, never hardcoded,
// because the model list changes.
export default function AdminAi() {
  const [settings, setSettings] = useState(null)
  const [keyInput, setKeyInput] = useState('')
  const [model, setModel] = useState('')
  const [models, setModels] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.settings.getAll().then((s) => {
      setSettings(s || {})
      setModel(s?.['ai.model'] || '')
    }).catch(() => setSettings({}))
  }, [])

  const savedKeyMask = settings?.['secret.anthropicKey']

  const save = async () => {
    setBusy(true); setError('')
    try {
      const patch = {}
      if (keyInput.trim()) patch['secret.anthropicKey'] = keyInput.trim()
      if (model) patch['ai.model'] = model
      if (Object.keys(patch).length) await api.settings.save(patch)
      const s = await api.settings.getAll()
      setSettings(s || {}); setKeyInput('')
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e.message || 'Could not save')
    } finally { setBusy(false) }
  }

  const loadModels = async () => {
    setBusy(true); setError(''); setModels(null)
    try {
      const list = await api.ai.models()
      setModels(list || [])
      if (!model && list?.length) setModel(list[0].id)
    } catch (e) {
      setError(e.message || 'Could not load models — is the key saved and valid?')
      setModels([])
    } finally { setBusy(false) }
  }

  if (settings === null) return <p className="admin-note">Loading AI settings…</p>

  return (
    <div className="admin-ai">
      <h3 className="admin-h3"><KeyRound size={16} /> Anthropic API key</h3>
      <p className="admin-note">
        Stored server-side and never sent to visitors' browsers. All Claude calls run through this
        site's own API. {savedKeyMask ? <>Current key: <code>{savedKeyMask}</code></> : 'No key saved yet.'}
      </p>
      <label className="admin-field admin-field--full">
        <span className="admin-field__label">{savedKeyMask ? 'Replace key' : 'API key'}</span>
        <input type="password" autoComplete="off" placeholder="sk-ant-…"
          value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
      </label>

      <h3 className="admin-h3" style={{ marginTop: 26 }}><Sparkles size={16} /> Model</h3>
      <p className="admin-note">
        Fetched live from the Anthropic API so new models appear automatically. Used by the
        packing-list generator (and future AI features).
      </p>
      <div className="admin__bar" style={{ marginBottom: 10 }}>
        <button className="btn btn--soft" onClick={loadModels} disabled={busy || (!savedKeyMask && !keyInput)}>
          <RefreshCw size={14} /> {busy && models === null ? 'Loading…' : 'Load available models'}
        </button>
        {model && !models && <span className="admin-note">Selected: <code>{model}</code></span>}
      </div>
      {models?.length > 0 && (
        <label className="admin-field admin-field--full">
          <span className="admin-field__label">Model to use</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {!models.some((m) => m.id === model) && model && <option value={model}>{model} (saved)</option>}
            {models.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.id}</option>)}
          </select>
        </label>
      )}
      {models?.length === 0 && models !== null && !error && <p className="admin-note">No models returned.</p>}
      {error && <p className="admin-ai__error">{error}</p>}

      <div className="admin__bar" style={{ marginTop: 18 }}>
        <button className="btn btn--primary" onClick={save} disabled={busy || (!keyInput.trim() && !model)}>
          {saved ? <><Check size={15} /> Saved</> : <><Save size={15} /> {busy ? 'Saving…' : 'Save AI settings'}</>}
        </button>
      </div>
    </div>
  )
}
