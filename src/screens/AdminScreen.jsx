import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Download, Pencil, Trash2, ArrowUpRight, ShieldAlert,
  PenLine, MapPin, Image as ImageIcon, BadgePercent, FileJson, LayoutGrid, Globe, Mail, Home, Sparkles } from 'lucide-react'
import { useAuth, GoogleSignInButton } from '../lib/auth.jsx'
import { getIndex } from '../lib/data.js'
import { paths } from '../lib/paths.js'
import AdminPlaces from '../components/admin/AdminPlaces.jsx'
import AdminImages from '../components/admin/AdminImages.jsx'
import AdminAffiliates from '../components/admin/AdminAffiliates.jsx'
import AdminExport from '../components/admin/AdminExport.jsx'
import AdminHub from '../components/admin/AdminHub.jsx'
import AdminBlog from '../components/admin/AdminBlog.jsx'
import AdminSeo from '../components/admin/AdminSeo.jsx'
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
  { id: 'seo', label: 'SEO', icon: Globe },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'export', label: 'Export', icon: FileJson },
]

export default function AdminScreen() {
  const { user, isAdmin, configured, isDev, devSignIn, signOut } = useAuth()
  const [section, setSection] = useState('journal')
  const [regions, setRegions] = useState([])

  useEffect(() => { getIndex().then((d) => setRegions(d.regions || [])).catch(() => setRegions([])) }, [])

  if (!user) {
    return (
      <Gate title="Sign in to continue" sub="The admin area lets you write posts and manage the guide's content.">
        {configured ? <GoogleSignInButton size="large" /> : (
          <>
            <p className="gate__note">Google sign-in isn't configured. Add <code>VITE_GOOGLE_CLIENT_ID</code> (and <code>VITE_ADMIN_EMAILS</code>) to <code>.env</code> to enable it.</p>
            {isDev && <button className="btn btn--primary" onClick={devSignIn}>Continue in dev mode</button>}
          </>
        )}
      </Gate>
    )
  }
  if (!isAdmin) {
    return (
      <Gate title="Not an admin" sub={`You're signed in as ${user.email}, which isn't on the admin allowlist.`} icon={<ShieldAlert size={26} />}>
        <button className="btn btn--soft" onClick={signOut}>Sign out</button>
      </Gate>
    )
  }

  return (
    <div className="page">
      <header className="sub-hero wrap">
        <p className="eyebrow">Admin</p>
        <h1 className="sub-hero__title">Content studio</h1>
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
