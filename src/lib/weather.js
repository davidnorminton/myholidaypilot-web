// Day forecasts from Open-Meteo (free, no key). Results are cached per
// coordinate+date for the session. Only dates within the ~16-day forecast
// window return anything; everything else resolves to null quietly.

const cache = new Map()

const CODES = [
  [[0], '☀️', 'Clear'],
  [[1, 2], '🌤️', 'Mostly sunny'],
  [[3], '☁️', 'Overcast'],
  [[45, 48], '🌫️', 'Fog'],
  [[51, 53, 55, 56, 57], '🌦️', 'Drizzle'],
  [[61, 63, 65, 66, 67, 80, 81, 82], '🌧️', 'Rain'],
  [[71, 73, 75, 77, 85, 86], '🌨️', 'Snow'],
  [[95, 96, 99], '⛈️', 'Thunderstorm'],
]

function describe(code) {
  for (const [codes, icon, label] of CODES) if (codes.includes(code)) return { icon, label }
  return { icon: '🌡️', label: '' }
}

function inForecastRange(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(date + 'T12:00')
  const diff = (d - today) / 86400000
  return diff >= 0 && diff <= 15
}

export async function dayWeather(lat, lng, date) {
  if (!lat || !lng || !date || !inForecastRange(date)) return null
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${date}`
  if (cache.has(key)) return cache.get(key)
  const promise = (async () => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${date}&end_date=${date}`
      const res = await fetch(url)
      if (!res.ok) return null
      const j = await res.json()
      const code = j?.daily?.weather_code?.[0]
      const max = j?.daily?.temperature_2m_max?.[0]
      if (code == null || max == null) return null
      return { ...describe(code), max: Math.round(max), min: Math.round(j.daily.temperature_2m_min?.[0]) }
    } catch { return null }
  })()
  cache.set(key, promise)
  return promise
}
