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


function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('Could not read the file'))
    r.onload = () => resolve(r.result)
    r.readAsDataURL(file)
  })
}

// Downscale to <= 2000px on the long edge and JPEG-encode, so the base64
// payload stays well under the serverless body limit. Returns a data URL, or
// throws (caller falls back to the raw file for tiny images / SVGs).
async function compressImage(file, maxEdge = 2000, quality = 0.82) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    throw new Error('skip-compression')
  }
  const dataUrl = await fileToDataUrl(file)
  const img = await new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('decode failed'))
    im.src = dataUrl
  })
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  const out = canvas.toDataURL('image/jpeg', quality)
  // if somehow larger than the original (rare), keep original
  if (out.length >= dataUrl.length) throw new Error('no-gain')
  return out
}

export const api = {
  async upload(file) {
    // Vercel serverless bodies are capped at ~4.5 MB, and base64 inflates
    // size by ~33%. Downscale + re-encode in the browser so the request is
    // always comfortably under the limit (and uploads are faster). The server
    // still converts to WebP and downsizes further; this just guarantees the
    // request fits.
    const prepared = await compressImage(file).catch(() => null)
    const filename = file.name
    const contentType = prepared ? 'image/jpeg' : file.type
    const dataBase64 = prepared || await fileToDataUrl(file)
    return req('POST', '/upload', { filename, contentType, dataBase64 })
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
    genDetail: (country, region, place) => req('POST', `/builder?action=detail&country=${country}&region=${region}&place=${place}`),
    genImage: (country, region, place) => req('POST', `/builder?action=image&country=${country}&region=${region}&place=${place}`),
    setImage: (country, region, place, url, credit) => req('POST', `/builder?action=setimage&country=${country}&region=${region}&place=${place}`, { url, credit }),
    missing: () => req('GET', '/builder?action=missing'),
    imageSearch: (query) => req('GET', `/builder?action=imagesearch&query=${encodeURIComponent(query)}`),
    genRestaurants: (country, region) => req('POST', `/builder?action=restaurants&country=${country}&region=${region}`),
    genRegionProse: (country, region) => req('POST', `/builder?action=regionprose&country=${country}&region=${region}`),
    genGuide: (country, topic) => req('POST', `/builder?action=guide&country=${country}&topic=${topic}`),
    saveRegion: (country, region, data) => req('PATCH', `/builder?type=region&country=${country}&region=${region}`, { data }),
    savePlace: (country, region, place, data, image) => req('PATCH', `/builder?type=place&country=${country}&region=${region}&place=${place}`, { data, image }),
    discard: (country) => req('DELETE', `/builder?country=${country}`),
    export: (country) => req('GET', `/builder?action=export&country=${country}`),
    guideFile: (country, topic) => req('GET', `/builder?action=guidefile&country=${country}&topic=${topic}`),
    setRegionHero: (country, region, url, credit) => req('POST', `/builder?action=regionhero&country=${country}&region=${region}`, { url, credit }),
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
  authEmail: {
    signup: (data) => req('POST', '/auth?action=signup', data),
    login: (data) => req('POST', '/auth?action=login', data),
  },
  contact: {
    send: (data) => req('POST', '/contact', data),
    list: () => req('GET', '/contact'),
    setHandled: (id, handled) => req('PATCH', '/contact', { id, handled }),
  },
  posts: {
    list: (all) => req('GET', all ? '/posts?all=1' : '/posts'),
    get: (slug) => req('GET', `/posts/${slug}`),
    create: (data) => req('POST', '/posts', data),
    update: (slug, data) => req('PATCH', `/posts/${slug}`, data),
    remove: (slug) => req('DELETE', `/posts/${slug}`),
  },
}
