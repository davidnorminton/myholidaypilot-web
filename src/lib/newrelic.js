// New Relic browser monitoring — JS errors, route changes, AJAX timing, Core
// Web Vitals from real users. This module is only ever loaded via dynamic
// import from main.jsx AFTER first paint, so the agent (and its own lazily
// loaded feature chunks) never sits in the critical path.
//
// Configured entirely by env vars, taken from the "Copy/Paste" box of a Browser
// app in New Relic (one.newrelic.com → Add data → Browser → Copy/Paste):
//   VITE_NR_LICENSE_KEY   NREUM.info.licenseKey
//   VITE_NR_APP_ID        NREUM.info.applicationID
//   VITE_NR_ACCOUNT_ID    NREUM.loader_config.accountID
//   VITE_NR_TRUST_KEY     optional; defaults to the account id
//   VITE_NR_BEACON        optional; EU accounts: bam.eu01.nr-data.net
// Any of the three required values absent (local dev, previews without env
// vars) and this is a silent no-op.
import { BrowserAgent } from '@newrelic/browser-agent/loaders/browser-agent'

const licenseKey = import.meta.env.VITE_NR_LICENSE_KEY
const applicationID = import.meta.env.VITE_NR_APP_ID
const accountID = import.meta.env.VITE_NR_ACCOUNT_ID

export function initNewRelic() {
  if (!licenseKey || !applicationID || !accountID) {
    // One line, once, so "is it even configured in this build?" is answerable
    // from any browser console instead of by archaeology. VITE_ vars are baked
    // at BUILD time — added-but-not-redeployed is the classic cause.
    console.info('[newrelic] browser agent not configured in this build')
    return null
  }
  const beacon = import.meta.env.VITE_NR_BEACON || 'bam.nr-data.net'
  try {
    return new BrowserAgent({
      init: {
        distributed_tracing: { enabled: true },
        privacy: { cookies_enabled: true },
      },
      info: { beacon, errorBeacon: beacon, licenseKey, applicationID, sa: 1 },
      loader_config: {
        accountID,
        trustKey: import.meta.env.VITE_NR_TRUST_KEY || accountID,
        agentID: applicationID,
        licenseKey,
        applicationID,
      },
    })
  } catch (e) {
    console.info('[newrelic] browser agent failed to start:', e?.message)
    return null   // monitoring must never take the app down
  }
}
