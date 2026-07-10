import { getDb, schema, eq, asc } from './_lib/db.js'
import { send, fail, handler } from './_lib/util.js'
const { airports } = schema

// Major airports worldwide for the ?near home-airport lookup — the DB only
// holds destination-country airports (currently Italy), but home airports can
// be anywhere. Coordinates are approximate reference points; nearest-match
// within 80 km only needs them to ~a few km. [iata, name, city, lat, lng]
const MAJORS = [
  ['LHR', 'London Heathrow', 'London', 51.470, -0.454], ['LGW', 'London Gatwick', 'London', 51.153, -0.182],
  ['STN', 'London Stansted', 'London', 51.885, 0.235], ['LTN', 'London Luton', 'London', 51.874, -0.368],
  ['LCY', 'London City', 'London', 51.505, 0.055], ['MAN', 'Manchester', 'Manchester', 53.365, -2.273],
  ['LBA', 'Leeds Bradford', 'Leeds', 53.866, -1.660], ['BHX', 'Birmingham', 'Birmingham', 52.454, -1.748],
  ['EDI', 'Edinburgh', 'Edinburgh', 55.950, -3.372], ['GLA', 'Glasgow', 'Glasgow', 55.872, -4.433],
  ['NCL', 'Newcastle', 'Newcastle', 55.037, -1.692], ['LPL', 'Liverpool John Lennon', 'Liverpool', 53.336, -2.850],
  ['BRS', 'Bristol', 'Bristol', 51.383, -2.719], ['EMA', 'East Midlands', 'Nottingham', 52.831, -1.328],
  ['SOU', 'Southampton', 'Southampton', 50.950, -1.357], ['CWL', 'Cardiff', 'Cardiff', 51.397, -3.343],
  ['BFS', 'Belfast International', 'Belfast', 54.658, -6.216], ['ABZ', 'Aberdeen', 'Aberdeen', 57.202, -2.198],
  ['DUB', 'Dublin', 'Dublin', 53.421, -6.270], ['ORK', 'Cork', 'Cork', 51.841, -8.491],
  ['CDG', 'Paris Charles de Gaulle', 'Paris', 49.010, 2.548], ['ORY', 'Paris Orly', 'Paris', 48.723, 2.379],
  ['AMS', 'Amsterdam Schiphol', 'Amsterdam', 52.310, 4.768], ['FRA', 'Frankfurt', 'Frankfurt', 50.038, 8.562],
  ['MUC', 'Munich', 'Munich', 48.354, 11.786], ['BER', 'Berlin Brandenburg', 'Berlin', 52.367, 13.503],
  ['MAD', 'Madrid Barajas', 'Madrid', 40.472, -3.561], ['BCN', 'Barcelona El Prat', 'Barcelona', 41.297, 2.078],
  ['LIS', 'Lisbon', 'Lisbon', 38.774, -9.134], ['OPO', 'Porto', 'Porto', 41.248, -8.681],
  ['ZRH', 'Zurich', 'Zurich', 47.458, 8.548], ['GVA', 'Geneva', 'Geneva', 46.238, 6.109],
  ['VIE', 'Vienna', 'Vienna', 48.110, 16.570], ['BRU', 'Brussels', 'Brussels', 50.901, 4.484],
  ['CPH', 'Copenhagen', 'Copenhagen', 55.618, 12.656], ['OSL', 'Oslo Gardermoen', 'Oslo', 60.194, 11.100],
  ['ARN', 'Stockholm Arlanda', 'Stockholm', 59.652, 17.919], ['HEL', 'Helsinki Vantaa', 'Helsinki', 60.317, 24.963],
  ['ATH', 'Athens', 'Athens', 37.936, 23.947], ['WAW', 'Warsaw Chopin', 'Warsaw', 52.166, 20.967],
  ['PRG', 'Prague', 'Prague', 50.101, 14.263], ['BUD', 'Budapest', 'Budapest', 47.439, 19.262],
  ['IST', 'Istanbul', 'Istanbul', 41.262, 28.727], ['DXB', 'Dubai', 'Dubai', 25.253, 55.365],
  ['DOH', 'Doha Hamad', 'Doha', 25.273, 51.608], ['SIN', 'Singapore Changi', 'Singapore', 1.359, 103.989],
  ['HKG', 'Hong Kong', 'Hong Kong', 22.308, 113.918], ['NRT', 'Tokyo Narita', 'Tokyo', 35.772, 140.393],
  ['HND', 'Tokyo Haneda', 'Tokyo', 35.549, 139.780], ['ICN', 'Seoul Incheon', 'Seoul', 37.469, 126.451],
  ['BKK', 'Bangkok Suvarnabhumi', 'Bangkok', 13.690, 100.750], ['SYD', 'Sydney', 'Sydney', -33.946, 151.177],
  ['MEL', 'Melbourne', 'Melbourne', -37.673, 144.843], ['AKL', 'Auckland', 'Auckland', -37.008, 174.792],
  ['JFK', 'New York JFK', 'New York', 40.640, -73.779], ['EWR', 'Newark', 'New York', 40.690, -74.169],
  ['BOS', 'Boston Logan', 'Boston', 42.366, -71.010], ['ORD', "Chicago O'Hare", 'Chicago', 41.974, -87.907],
  ['ATL', 'Atlanta', 'Atlanta', 33.640, -84.427], ['DFW', 'Dallas Fort Worth', 'Dallas', 32.899, -97.040],
  ['MIA', 'Miami', 'Miami', 25.796, -80.287], ['LAX', 'Los Angeles', 'Los Angeles', 33.941, -118.409],
  ['SFO', 'San Francisco', 'San Francisco', 37.622, -122.379], ['SEA', 'Seattle Tacoma', 'Seattle', 47.448, -122.309],
  ['YYZ', 'Toronto Pearson', 'Toronto', 43.678, -79.625], ['YVR', 'Vancouver', 'Vancouver', 49.195, -123.182],
  ['YUL', 'Montreal Trudeau', 'Montreal', 45.468, -73.741],
].map(([iata, name, city, lat, lng]) => ({ id: `world-${iata}`, iata, name, city, lat, lng, countryId: 'world', address: '' }))

// Public list of airports for a country, for the trip planner's
// arrive/depart picker. With ?near=lat,lng it instead returns the nearest
// curated airport (any country) within ~80 km — used to resolve an IATA for
// map-picked home airports.
export default handler(async (req, res) => {
  if (req.method !== 'GET') throw fail(405, 'Method not allowed')
  const url = new URL(req.url, 'http://x')
  const db = getDb()
  const near = url.searchParams.get('near')
  if (near) {
    const [lat, lng] = near.split(',').map(Number)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw fail(400, 'Bad near parameter')
    const rows = await db.select().from(airports)
    const dbIatas = new Set(rows.map((r) => r.iata))
    const pool = [...rows, ...MAJORS.filter((m) => !dbIatas.has(m.iata))]
    const toRad = (d) => (d * Math.PI) / 180
    const dist = (a) => {
      const dLat = toRad(a.lat - lat), dLng = toRad(a.lng - lng)
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(a.lat)) * Math.sin(dLng / 2) ** 2
      return 12742 * Math.asin(Math.sqrt(h))   // km
    }
    const best = pool.map((a) => ({ a, d: dist(a) })).sort((x, y) => x.d - y.d)[0]
    send(res, 200, best && best.d <= 80 ? [best.a] : [])
    return
  }
  const country = url.searchParams.get('country') || 'italy'
  const rows = await db.select().from(airports)
    .where(eq(airports.countryId, country)).orderBy(asc(airports.city), asc(airports.name))
  send(res, 200, rows)
})
