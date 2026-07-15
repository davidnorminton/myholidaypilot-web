import { isUnsplashUrl, parseCredit, profileUrl, UNSPLASH_HOME } from '../lib/unsplash.js'

// "Photo by Jane Doe on Unsplash" — the attribution the Unsplash API Terms
// require wherever we display one of their photos.
//
// Renders nothing unless the image is actually hosted by Unsplash, so our own
// uploads don't get a bogus credit.
//
// The profile link needs the photographer's username. Two ways we might have it,
// best first: an explicit creditUrl/creditUsername captured at pick time, or one
// embedded in the credit string itself (see parseCredit). Failing both we name
// the photographer and link Unsplash but not the profile — short of the Terms,
// and fixed per-image by scripts/backfill-credits.mjs.
export default function PhotoCredit({ url, credit, creditUrl, creditUsername, className = '' }) {
  if (!isUnsplashUrl(url) || !credit) return null
  const { name, username } = parseCredit(credit)
  if (!name) return null
  const profile = profileUrl({ creditUrl, creditUsername: creditUsername || username })
  return (
    <p className={`photocredit ${className}`}>
      Photo by{' '}
      {profile
        ? <a href={profile} target="_blank" rel="noopener noreferrer nofollow">{name}</a>
        : <span>{name}</span>}
      {' '}on{' '}
      <a href={UNSPLASH_HOME} target="_blank" rel="noopener noreferrer nofollow">Unsplash</a>
    </p>
  )
}
