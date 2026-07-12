import { useEffect, useState } from 'react'
import { PenLine, BadgePercent, FileJson, Globe, Mail, Home, Sparkles, Globe2, MessageSquare, ImageOff, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import NotFoundScreen from './NotFoundScreen.jsx'
import { getIndex } from '../lib/data.js'
import AdminCountries from '../components/admin/AdminCountries.jsx'
import AdminAffiliates from '../components/admin/AdminAffiliates.jsx'
import AdminExport from '../components/admin/AdminExport.jsx'
import AdminBlog from '../components/admin/AdminBlog.jsx'
import AdminSeo from '../components/admin/AdminSeo.jsx'
import AdminGallery from '../components/admin/AdminGallery.jsx'
import AdminComments from '../components/admin/AdminComments.jsx'
import AdminStats from '../components/admin/AdminStats.jsx'
import AdminMissingImages from '../components/admin/AdminMissingImages.jsx'
import AdminContact from '../components/admin/AdminContact.jsx'
import AdminAudience from '../components/admin/AdminAudience.jsx'
import AdminSite from '../components/admin/AdminSite.jsx'
import AdminAi from '../components/admin/AdminAi.jsx'

const NAV = [
  { group: null, ids: ['dash'] },
  { group: 'Content', ids: ['journal', 'site', 'countries', 'gallery'] },
  { group: 'Build', ids: ['missing', 'ai', 'export'] },
  { group: 'Growth', ids: ['audience', 'affiliates', 'comments', 'contact', 'seo'] },
]

const SECTIONS = [
  { id: 'dash', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'site', label: 'Site', icon: Home },
  { id: 'journal', label: 'Blog', icon: PenLine },
  { id: 'countries', label: 'Countries', icon: Globe2 },
  { id: 'affiliates', label: 'Affiliates', icon: BadgePercent },
  { id: 'audience', label: 'Newsletter', icon: Mail },
  { id: 'gallery', label: 'Gallery', icon: Globe2 },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
  { id: 'contact', label: 'Contact', icon: Mail },
  { id: 'seo', label: 'SEO', icon: Globe },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'missing', label: 'Missing images', icon: ImageOff },
  { id: 'export', label: 'Export', icon: FileJson },
]

export default function AdminScreen() {
  const { user, isAdmin, isDev, devSignIn } = useAuth()
  const [section, setSection] = useState('dash')
  const [regions, setRegions] = useState([])

  useEffect(() => { getIndex().then((d) => setRegions(d.regions || [])).catch(() => setRegions([])) }, [])

  // Anyone who isn't a signed-in admin sees the site's ordinary 404 — the
  // admin area shouldn't advertise its existence. (In local dev, a dev
  // sign-in button is still offered so the studio stays reachable.)
  if (!user || !isAdmin) {
    if (isDev && !user) {
      return (
        <Gate title="Sign in to continue" sub="Local development sign-in.">
          <button className="btn btn--primary" onClick={devSignIn}>Continue in dev mode</button>
        </Gate>
      )
    }
    return <NotFoundScreen />
  }

  return (
    <div className="page">
      <div className="adminshell">
        <aside className="adminside" aria-label="Admin sections">
          {NAV.map(({ group, ids }) => (
            <div key={group || 'top'} className="adminside__group">
              {group && <p className="adminside__grouplabel">{group}</p>}
              {ids.map((id) => {
                const sec = SECTIONS.find((x) => x.id === id)
                if (!sec) return null
                const Icon = sec.icon
                return (
                  <button key={id} className={`adminside__item ${section === id ? 'is-on' : ''}`} onClick={() => setSection(id)}>
                    <Icon size={16} strokeWidth={2.1} /> {sec.label}
                  </button>
                )
              })}
            </div>
          ))}
        </aside>

        <main className="adminshell__main admin">
        {section === 'dash' && (
          <header className="sub-hero">
            <p className="eyebrow">Admin</p>
            <h1 className="sub-hero__title">Content studio</h1>
            <AdminStats />
            <p className="sub-hero__sub">Write posts and edit the guide. Changes show live on this device — use <b>Export</b> to download the JSON files and commit them.</p>
          </header>
        )}
        {section === 'journal' && <AdminBlog />}
        {section === 'site' && <AdminSite regions={regions} />}
        {section === 'countries' && <AdminCountries regions={regions} />}
        {section === 'affiliates' && <AdminAffiliates />}
        {section === 'audience' && <AdminAudience />}
        {section === 'gallery' && <AdminGallery />}
        {section === 'comments' && <AdminComments />}
        {section === 'contact' && <AdminContact />}
        {section === 'seo' && <AdminSeo />}
        {section === 'ai' && <AdminAi />}
        {section === 'missing' && <AdminMissingImages />}
        {section === 'export' && <AdminExport regions={regions} />}
        </main>
      </div>
    </div>
  )
}

function Gate({ title, sub, icon, children }) {
  return (
    <div className="page wrap">
      <div className="gate">
        {icon && <span className="gate__icon">{icon}</span>}
        <h1 className="gate__title">{title}</h1>
        <p className="gate__sub">{sub}</p>
        <div className="gate__action">{children}</div>
      </div>
    </div>
  )
}
