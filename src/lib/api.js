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
  trips: {
    list: () => req('GET', '/trips'),
    create: (data) => req('POST', '/trips', data),
    get: (id) => req('GET', `/trips/${id}`),
    update: (id, data) => req('PATCH', `/trips/${id}`, data),
    remove: (id) => req('DELETE', `/trips/${id}`),
    addPlace: (data) => req('POST', '/trip-places', data),
    updatePlace: (data) => req('PATCH', '/trip-places', data),
    removePlace: (tripId, regionId, placeId) =>
      req('DELETE', `/trip-places?tripId=${tripId}&regionId=${encodeURIComponent(regionId)}&placeId=${encodeURIComponent(placeId)}`),
  },
  subscribe: {
    add: (email) => req('POST', '/subscribe', { email }),
    list: () => req('GET', '/subscribe'),
  },
  comments: {
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
