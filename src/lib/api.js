// Thin client for the /api serverless routes. Call setApiAuth() once after
// sign-in so the server can identify the user; everything else is plain fetch.
let authHeader = {}

export function setApiAuth({ credential, session, devEmail, devId, devName } = {}) {
  authHeader = {}
  if (session) authHeader['x-session'] = session
  if (credential) authHeader.Authorization = `Bearer ${credential}`
  if (!session && !credential && devEmail) {
    authHeader = { 'x-dev-email': devEmail, 'x-dev-id': devId || devEmail, 'x-dev-name': devName || '' }
  }
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
  session: {
    start: () => req('POST', '/session'),
    end: () => req('DELETE', '/session'),
  },
  syncUser: () => req('POST', '/me'),
  favourites: {
    list: () => req('GET', '/favourites'),
    add: (regionId, placeId) => req('POST', '/favourites', { regionId, placeId }),
    remove: (regionId, placeId) => req('DELETE', `/favourites?regionId=${encodeURIComponent(regionId)}&placeId=${encodeURIComponent(placeId)}`),
  },
  stats: () => req('GET', '/stats'),
  builder: {
    list: () => req('GET', '/builder'),
    get: (country) => req('GET', `/builder?country=${country}`),
    region: (country, region) => req('GET', `/builder?country=${country}&region=${region}`),
    create: (payload) => req('POST', '/builder?action=create', payload),
    genRegions: (country) => req('POST', `/builder?action=regions&country=${country}`),
    genPlaces: (country, region) => req('POST', `/builder?action=places&country=${country}&region=${region}`),
    deletePlace: (country, region, place) => req('DELETE', `/builder?country=${country}&region=${region}&place=${place}`),
    saveRegion: (country, region, data) => req('PATCH', `/builder?type=region&country=${country}&region=${region}`, { data }),
    savePlace: (country, region, place, data, image) => req('PATCH', `/builder?type=place&country=${country}&region=${region}&place=${place}`, { data, image }),
    discard: (country) => req('DELETE', `/builder?country=${country}`),
  },
  commentsAdmin: {
    list: () => req('GET', '/comments?admin=1'),
    setStatus: (id, status) => req('PATCH', '/comments', { id, status }),
    remove: (id) => req('DELETE', `/comments?id=${encodeURIComponent(id)}`),
  },
  gallery: {
    list: (country) => req('GET', `/gallery${country ? `?country=${country}` : ''}`),
    get: (slug) => req('GET', `/gallery?slug=${encodeURIComponent(slug)}`),
    mine: () => req('GET', '/gallery?mine=1'),
    publish: (tripId, attribution) => req('POST', '/gallery?action=publish', { tripId, attribution }),
    copied: (slug) => req('POST', '/gallery?action=copied', { slug }),
    unpublish: (tripId) => req('DELETE', `/gallery?tripId=${encodeURIComponent(tripId)}`),
    adminList: () => req('GET', '/gallery?admin=1'),
    adminPatch: (id, patch) => req('PATCH', '/gallery', { id, ...patch }),
    adminRemove: (id) => req('DELETE', `/gallery?id=${encodeURIComponent(id)}`),
  },
  ai: {
    models: () => req('GET', '/ai?action=models'),
    packing: (payload) => req('POST', '/ai?action=packing', payload),
    budget: (payload) => req('POST', '/ai?action=budget', payload),
    narrate: (payload) => req('POST', '/ai?action=narrate', payload),
    blogPost: (payload) => req('POST', '/ai?action=blog', payload),
    place: (payload) => req('POST', '/ai?action=place', payload),
    review: (payload) => req('POST', '/ai?action=review', payload),
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
