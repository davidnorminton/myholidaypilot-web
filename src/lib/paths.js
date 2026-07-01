// Central place for route building. Country is fixed to Italy for now;
// add more countries later by threading a country slug through here.
export const COUNTRY = 'italy'

export const paths = {
  home: () => '/',
  destinations: () => '/destinations',
  country: (c = COUNTRY) => `/${c}`,
  italyRegions: (c = COUNTRY) => `/${c}/regions`,
  guide: (topic, c = COUNTRY) => `/${c}/${topic}`,
  region: (regionId, c = COUNTRY) => `/${c}/${regionId}`,
  place: (regionId, placeId, c = COUNTRY) => `/${c}/${regionId}/${placeId}`,
  plan: () => '/plan',
  blog: () => '/blog',
  post: (slug) => `/blog/${slug}`,
  app: () => '/app',
  admin: () => '/admin',
  saved: () => '/saved',
}
