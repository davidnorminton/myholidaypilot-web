import { Mail } from 'lucide-react'
import { useSettings } from '../lib/settings.js'
import { useSeo } from '../lib/seo.js'
import PageHero from '../components/PageHero.jsx'

export default function ContactScreen() {
  const site = useSettings()
  const email = site['contact.email'] || 'hello@myholidaypilot.com'
  useSeo({ title: 'Contact us', description: 'Questions, corrections or ideas — get in touch with the myholidaypilot team.', path: '/contact' })

  return (
    <div className="page">
      <PageHero id="contact" eyebrow="myholidaypilot" title="Get in touch" emoji="✉️"
        sub="Questions, corrections, or a place we've missed — we'd love to hear from you." />
      <main className="wrap contact">
        <div className="contact__card">
          <Mail size={22} className="contact__icon" />
          <p className="contact__lead">The best way to reach us is email. We read everything and reply when we can.</p>
          <a className="btn btn--primary contact__btn" href={`mailto:${email}`}>Email {email}</a>
        </div>
        <div className="contact__notes">
          <p><strong>Spotted something wrong?</strong> Opening times, a closed restaurant, a changed train route — tell us the country and place and we'll fix it.</p>
          <p><strong>Want your country covered?</strong> We're adding new countries all the time. Let us know where you'd like to see next.</p>
          <p><strong>Press or partnerships?</strong> Same address — put "press" or "partnership" in the subject line.</p>
        </div>
      </main>
    </div>
  )
}
