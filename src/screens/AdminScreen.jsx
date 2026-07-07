import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Download, Pencil, Trash2, ArrowUpRight, PenLine, MapPin, Image as ImageIcon, BadgePercent, FileJson, Globe, Mail, Home, Sparkles, Globe2, MessageSquare, Hammer, ImageOff, CalendarRange } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import NotFoundScreen from './NotFoundScreen.jsx'
import { getIndex } from '../lib/data.js'
import { paths } from '../lib/paths.js'
import AdminPlaces from '../components/admin/AdminPlaces.jsx'
import AdminImages from '../components/admin/AdminImages.jsx'
import AdminAffiliates from '../components/admin/AdminAffiliates.jsx'
import AdminExport from '../components/admin/AdminExport.jsx'
import AdminBlog from '../components/admin/AdminBlog.jsx'
import AdminSeo from '../components/admin/AdminSeo.jsx'
import AdminGallery from '../components/admin/AdminGallery.jsx'
import AdminComments from '../components/admin/AdminComments.jsx'
import AdminStats from '../components/admin/AdminStats.jsx'
import AdminMissingImages from '../components/admin/AdminMissingImages.jsx'
import AdminContact from '../components/admin/AdminContact.jsx'
import AdminBuilder from '../components/admin/AdminBuilder.jsx'
import AdminAudience from '../components/admin/AdminAudience.jsx'
import AdminSite from '../components/admin/AdminSite.jsx'
import AdminDetails from '../components/admin/AdminDetails.jsx'
import AdminAi from '../components/admin/AdminAi.jsx'

const SECTIONS = [
  { id: 'site', label: 'Site', icon: Home },
  { id: 'journal', label: 'Blog', icon: PenLine },
  { id: 'places', label: 'Places', icon: MapPin },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'affiliates', label: 'Affiliates', icon: BadgePercent },
  { id: 'audience', label: 'Newsletter', icon: Mail },
  { id: 'gallery', label: 'Gallery', icon: Globe2 },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
  { id: 'contact', label: 'Contact', icon: Mail },
  { id: 'seo', label: 'SEO', icon: Globe },
  { id: 'details', label: 'Trip details', icon: CalendarRange },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'builder', label: 'Country builder', icon: Hammer },
  { id: 'missing', label: 'Missing images', icon: ImageOff },
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

      <nav className="admin-nav wrap">
        <label className="admin-nav__select">
          <span className="admin-nav__label">Section</span>
          <select value={section} onChange={(e) => setSection(e.target.value)}>
            <optgroup label="Content">
              <option value="journal">Blog</option>
              <option value="site">Site</option>
              <option value="places">Places</option>
              <option value="images">Images</option>
              <option value="gallery">Gallery</option>
            </optgroup>
            <optgroup label="Build">
              <option value="builder">Country builder</option>
              <option value="missing">Missing images</option>
              <option value="ai">AI</option>
              <option value="export">Export</option>
            </optgroup>
            <optgroup label="Growth">
              <option value="audience">Newsletter</option>
              <option value="affiliates">Affiliates</option>
              <option value="comments">Comments</option>
              <option value="contact">Contact</option>
              <option value="seo">SEO</option>
            </optgroup>
          </select>
        </label>
        {(() => {
          const cur = SECTIONS.find((s) => s.id === section)
          const Icon = cur?.icon
          return cur ? <span className="admin-nav__current">{Icon && <Icon size={16} strokeWidth={2.2} />} {cur.label}</span> : null
        })()}
      </nav>

      <main className="wrap admin">
        {section === 'journal' && <AdminBlog />}
        {section === 'site' && <AdminSite regions={regions} />}
        {section === 'details' && <AdminDetails />}
        {section === 'places' && <AdminPlaces regions={regions} />}
        {section === 'images' && <AdminImages regions={regions} />}
        {section === 'affiliates' && <AdminAffiliates />}
        {section === 'audience' && <AdminAudience />}
        {section === 'gallery' && <AdminGallery />}
        {section === 'comments' && <AdminComments />}
        {section === 'contact' && <AdminContact />}
        {section === 'seo' && <AdminSeo />}
        {section === 'ai' && <AdminAi />}
        {section === 'builder' && <AdminBuilder />}
        {section === 'missing' && <AdminMissingImages />}
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
