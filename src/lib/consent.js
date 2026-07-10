// Cookie / storage consent. 'accepted' = everything (incl. ads if enabled);
// 'essential' = only what the site needs to work. Absent = not chosen yet.
const KEY = 'mhp.consent'
const subs = new Set()

export function getConsent() {
  try { return localStorage.getItem(KEY) || '' } catch { return '' }
}
export function setConsent(v) {
  try { localStorage.setItem(KEY, v) } catch { /* ignore */ }
  subs.forEach((cb) => cb(v))
}
export function onConsent(cb) { subs.add(cb); return () => subs.delete(cb) }
