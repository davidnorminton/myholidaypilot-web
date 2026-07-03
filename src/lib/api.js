// Thin client for the /api serverless routes. Call setApiAuth() once after
// sign-in so the server can identify the user; everything else is plain fetch.
let authHeader = {}

export function setApiAuth({ credential, devEmail, devId, devName } = {}) {
  if (credential) authHeader = { Authorization: `Bearer ${credential}` }
  else if (devEmail) authHeader = { 'x-dev-email': devEmail, 'x-dev-id': devId || devEmail, 'x-dev-name': devName || '' }
  else authHeader = {}
}

async function req(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || res.statusText)
  return res.status === 204 ? null : res.json()
}

export const api = {
  upload(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Could not read the file'))
      reader.onload = () => req('POST', '/upload', { filename: file.name, contentType: file.type, dataBase64: reader.result }).then(resolve, reject)
      reader.readAsDataURL(file)
    })
  },
  me: () => req('GET', '/me'),
  syncUser: () => req('POST', '/me'),
  favourites: {
    list: () => req('GET', '/favourites'),
    add: (regionId, placeId) => req('POST', '/favourites', { regionId, placeId }),
    remove: (regionId, placeId) => req('DELETE', `/favourites?regionId=${encodeURIComponent(regionId)}&placeId=${encodeURIComponent(placeId)}`),
  },
  ai: {
    models: () => req('GET', '/ai?action=models'),
    packing: (payload) => req('POST', '/ai?action=packing', payload),
    budget: (payload) => req('POST', '/ai?action=budget', payload),
    narrate: (payload) => req('POST', '/ai?action=narrate', payload),
    blogPost: (payload) => req('POST', '/ai?action=blog', payload),
  },
  visits: {
    list: () => req('GET', '/visits'),
    add: (regionId, countryId) => req('POST', '/visits', { regionId, countryId }),
    remove: (regionId) => req('DELETE', `/visits?regionId=${encodeURIComponent(regionId)}`),
  },
  settings: {
    get: () => req('GET', '/settings'),
    getAll: () => req('GET', '/settings?all=1'),
    save: (obj) => req('PUT', '/settings', obj),
  },
  airports: {
    list: (country = 'italy') => req('GET', `/airports?country=${encodeURIComponent(country)}`),
  },
  trips: {
    list: () => req('GET', '/trips'),
    upsert: (trip) => req('POST', '/trips', trip),
    remove: (id) => req('DELETE', `/trips?id=${encodeURIComponent(id)}`),
  },
  subscribe: {
    add: (email) => req('POST', '/subscribe', { email }),
    list: () => req('GET', '/subscribe'),
  },
  comments: {
    mine: () => req('GET', '/comments?mine=1'),
    list: ({ countryId, targetType, regionId, placeId }) => {
      const q = new URLSearchParams({ country: countryId, type: targetType, region: regionId })
      if (placeId) q.set('place', placeId)
      return req('GET', `/comments?${q}`)
    },
    add: (data) => req('POST', '/comments', data),
    remove: (id) => req('DELETE', `/comments/${id}`),
  },
  posts: {
    list: (all) => req('GET', all ? '/posts?all=1' : '/posts'),
    get: (slug) => req('GET', `/posts/${slug}`),
    create: (data) => req('POST', '/posts', data),
    update: (slug, data) => req('PATCH', `/posts/${slug}`, data),
    remove: (slug) => req('DELETE', `/posts/${slug}`),
  },
}
