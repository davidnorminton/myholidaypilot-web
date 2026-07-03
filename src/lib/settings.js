// Site settings (admin-editable): fetched once per session, shared via a hook.
import { useEffect, useState } from 'react'
import { api } from './api.js'

let cache = null
let inflight = null

export function getSettings() {
  if (cache) return Promise.resolve(cache)
  if (!inflight) inflight = api.settings.get().then((s) => (cache = s || {})).catch(() => (cache = {}))
  return inflight
}

export function clearSettingsCache() { cache = null; inflight = null }

export function useSettings() {
  const [s, setS] = useState(cache)
  useEffect(() => { let on = true; getSettings().then((v) => on && setS(v)); return () => { on = false } }, [])
  return s || {}
}
