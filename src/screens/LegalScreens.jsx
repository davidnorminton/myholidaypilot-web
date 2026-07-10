import { Link } from 'react-router-dom'
import { useSeo } from '../lib/seo.js'
import { paths } from '../lib/paths.js'

const UPDATED = '10 July 2026'

function LegalShell({ title, children }) {
  return (
    <div className="page">
      <header className="sub-hero wrap">
        <p className="eyebrow">myholidaypilot</p>
        <h1 className="sub-hero__title">{title}</h1>
        <p className="sub-hero__sub">Last updated {UPDATED}</p>
      </header>
      <main className="wrap legal">{children}</main>
    </div>
  )
}

export function PrivacyScreen() {
  useSeo({ title: 'Privacy policy', description: 'How myholidaypilot collects, uses and protects your information.', path: '/privacy' })
  return (
    <LegalShell title="Privacy policy">
      <h2>Who we are</h2>
      <p>myholidaypilot is a trip-planning website. This policy explains what information we hold when you use it, why, and the choices you have. Questions? <Link to={paths.contact()}>Contact us</Link>.</p>

      <h2>What we collect</h2>
      <p><b>If you browse without signing in</b>, we don't collect personal information. Your draft trips and preferences live in your own browser's storage and never reach our servers.</p>
      <p><b>If you sign in with Google</b>, we receive your name, email address and profile picture from Google, and we store them so your account works. We never see your Google password.</p>
      <p><b>If you plan trips while signed in</b>, your trips (places, dates, activities, stays, flights and notes) are stored on our servers so they sync across your devices.</p>
      <p><b>If you publish a trip to the gallery</b>, a sanitised copy becomes public: places, day numbers and picks. Real dates become relative day numbers, and stay addresses, flights, packing lists and budgets are stripped before publishing. You can choose whether your first name appears, and you can unpublish at any time.</p>
      <p><b>If you join the newsletter</b>, we store the email address you give us, only to send you the newsletter. Every email includes an unsubscribe link.</p>

      <h2>What we don't do</h2>
      <p>We don't sell your data. We don't run analytics trackers. We don't set advertising cookies unless you explicitly accept them via the cookie banner — and even then only if advertising is running on the site.</p>

      <h2>Third parties involved in running the site</h2>
      <p><b>Google</b> provides sign-in. <b>Mapbox</b> serves the maps — loading a map sends your IP address to Mapbox, as with any map provider. Our hosting and database providers process data on our behalf to run the service.</p>
      <p><b>Affiliate partners</b> — some links (marked "ad") lead to partners such as Viator, Booking.com, Skyscanner and Amazon. If you click one, that partner's own privacy policy applies on their site, and they may set a cookie there so we earn a commission on bookings. Following those links is always your choice.</p>

      <h2>Cookies and browser storage</h2>
      <p>Covered in detail in our <Link to="/cookies">cookie policy</Link>. In short: essential storage only, unless you accept more.</p>

      <h2>How long we keep things</h2>
      <p>Account data and trips are kept while your account exists. Published trips remain public until you unpublish them. Newsletter addresses are kept until you unsubscribe.</p>

      <h2>Your rights</h2>
      <p>You can ask for a copy of the personal data we hold about you, ask us to correct it, or ask us to delete your account and its data — <Link to={paths.contact()}>contact us</Link> and we'll act on it. You can also delete individual trips yourself at any time from the planner.</p>

      <h2>Changes</h2>
      <p>If this policy changes materially, we'll update the date at the top and note it on the site.</p>
    </LegalShell>
  )
}

export function TermsScreen() {
  useSeo({ title: 'Terms of use', description: 'The terms that apply when you use myholidaypilot.', path: '/terms' })
  return (
    <LegalShell title="Terms of use">
      <h2>Using the site</h2>
      <p>myholidaypilot is a free trip-planning tool. By using it you agree to these terms. If you don't agree, please don't use the site.</p>

      <h2>Travel information</h2>
      <p>Guides, itineraries, opening details, prices, weather and travel times are provided in good faith to help you plan, but places change — things close, prices move, festivals shift dates. <b>Always verify the important details</b> (tickets, opening hours, entry requirements) with the venue or operator before you travel. We accept no liability for decisions made on the basis of the information here.</p>

      <h2>Bookings and affiliate links</h2>
      <p>We don't sell flights, accommodation or activities. Links marked "ad" take you to partners (such as Viator, Booking.com, Skyscanner and Amazon) — your contract for anything you book is with that partner or the underlying supplier, on their terms. We may earn a commission on bookings made through those links, at no extra cost to you.</p>

      <h2>Your account and content</h2>
      <p>Keep your account access to yourself and use the site lawfully. Trips you publish to the gallery are shared publicly for other travellers to view and copy — publish only what you're happy to make public, and don't include unlawful or offensive content. You can unpublish at any time. We may remove published content that breaks these terms and may suspend accounts that abuse the service.</p>

      <h2>Our content</h2>
      <p>The site's design, text and data compilations belong to myholidaypilot or its licensors. You're welcome to use the site for personal trip planning; automated scraping or republishing our content isn't allowed without permission.</p>

      <h2>Service availability</h2>
      <p>The site is provided "as is", without warranties. We work to keep it available and accurate but can't guarantee uninterrupted service, and features may change or be withdrawn.</p>

      <h2>Liability</h2>
      <p>To the fullest extent permitted by law, we're not liable for indirect or consequential losses arising from your use of the site. Nothing in these terms excludes liability that cannot lawfully be excluded.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of England and Wales.</p>

      <h2>Questions</h2>
      <p><Link to={paths.contact()}>Contact us</Link> — we're happy to clarify anything here.</p>
    </LegalShell>
  )
}

export function CookiesScreen() {
  useSeo({ title: 'Cookie policy', description: 'How myholidaypilot uses cookies and browser storage.', path: '/cookies' })
  return (
    <LegalShell title="Cookie policy">
      <h2>The short version</h2>
      <p>We don't set tracking cookies. The site uses your browser's storage to make things work, and one cookie-like session token when you sign in. Advertising, if it ever runs, only loads after you choose "Accept all" on the cookie banner.</p>

      <h2>Essential storage (always on)</h2>
      <p>These live in your browser and the site doesn't work properly without them:</p>
      <p><b>Your trips and preferences</b> — draft trips, saved days, your home airport, hero form drafts and similar planner state, stored locally so nothing is lost between visits.</p>
      <p><b>Sign-in session</b> — a token that keeps you signed in after you log in with Google.</p>
      <p><b>Your cookie choice</b> — so we don't ask you again.</p>

      <h2>Optional (only with "Accept all")</h2>
      <p><b>Advertising</b> — if advertising is enabled on the site, Google AdSense sets cookies to serve and measure ads. With "Essential only", the ad scripts are never loaded at all.</p>

      <h2>Third-party requests</h2>
      <p>Maps are served by Mapbox and images by their hosts — loading them shares your IP address with those providers, as with any website resource. Clicking an affiliate link (marked "ad") takes you to a partner site where their own cookies apply.</p>

      <h2>Changing your choice</h2>
      <p>Clear this site's data in your browser settings and the banner will ask again on your next visit. Your locally-stored trips are part of that data — signed-in trips are safe on your account either way.</p>

      <p>More detail on data handling is in the <Link to="/privacy">privacy policy</Link>.</p>
    </LegalShell>
  )
}
