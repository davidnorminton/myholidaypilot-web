import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Download, Pencil, Trash2, ArrowUpRight,
  PenLine, MapPin, Image as ImageIcon, BadgePercent, FileJson, LayoutGrid, Globe, Mail, Home, Sparkles, Globe2, MessageSquare } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import NotFoundScreen from './NotFoundScreen.jsx'
import { getIndex } from '../lib/data.js'
import { paths } from '../lib/paths.js'
import AdminPlaces from '../components/admin/AdminPlaces.jsx'
import AdminImages from '../components/admin/AdminImages.jsx'
import AdminAffiliates from '../components/admin/AdminAffiliates.jsx'
import AdminExport from '../components/admin/AdminExport.jsx'
import AdminHub from '../components/admin/AdminHub.jsx'
import AdminBlog from '../components/admin/AdminBlog.jsx'
import AdminSeo from '../components/admin/AdminSeo.jsx'
import AdminGallery from '../components/admin/AdminGallery.jsx'
import AdminComments from '../components/admin/AdminComments.jsx'
import AdminStats from '../components/admin/AdminStats.jsx'
import AdminAudience from '../components/admin/AdminAudience.jsx'
import AdminSite from '../components/admin/AdminSite.jsx'
import AdminAi from '../components/admin/AdminAi.jsx'

const SECTIONS = [
  { id: 'site', label: 'Site', icon: Home },
  { id: 'journal', label: 'Blog', icon: PenLine },
  { id: 'hub', label: 'Italy page', icon: LayoutGrid },
  { id: 'places', label: 'Places', icon: MapPin },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'affiliates', label: 'Affiliates', icon: BadgePercent },
  { id: 'audience', label: 'Newsletter', icon: Mail },
  { id: 'gallery', label: 'Gallery', icon: Globe2 },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
  { id: 'seo', label: 'SEO', icon: Globe },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'export', label: 'Export', icon: FileJson },
]

export default function AdminScreen() {
  const { user, isAdmin, isDev, devSignIn } = useAuth()
  const [section, setSection] = useState('journal')
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
      <header className="sub-hero wrap">
        <p className="eyebrow">Admin</p>
        <h1 className="sub-hero__title">Content studio</h1>
        <AdminStats />
        <p className="sub-hero__sub">Write posts and edit the guide. Changes show live on this device — use <b>Export</b> to download the JSON files and commit them.</p>
      </header>

      <nav className="tabs admin-tabs wrap">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <button key={s.id} className={`tab ${section === s.id ? 'tab--on' : ''}`} onClick={() => setSection(s.id)}>
              <Icon size={15} strokeWidth={2.2} /> {s.label}
            </button>
          )
        })}
      </nav>

      <main className="wrap admin">
        {section === 'journal' && <AdminBlog />}
        {section === 'site' && <AdminSite regions={regions} />}
        {section === 'hub' && <AdminHub />}
        {section === 'places' && <AdminPlaces regions={regions} />}
        {section === 'images' && <AdminImages regions={regions} />}
        {section === 'affiliates' && <AdminAffiliates />}
        {section === 'audience' && <AdminAudience />}
        {section === 'gallery' && <AdminGallery />}
        {section === 'comments' && <AdminComments />}
        {section === 'seo' && <AdminSeo />}
        {section === 'ai' && <AdminAi />}
        {section === 'export' && <AdminExport regions={regions} />}
      </main>
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
