import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, ArrowUpRight, Save, X, Eye, Code2, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api.js'
import { bodyToHtml } from '../../lib/blogStore.js'
import ImageField from '../ImageField.jsx'
import { paths } from '../../lib/paths.js'

const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
const today = () => new Date().toISOString().slice(0, 10)
const EMPTY = { _orig: null, slug: '', title: '', tag: 'Field notes', author: 'The Pilot', coverImage: '', dek: '', body: '', status: 'draft', date: '' }
const PLACEHOLDER = '<p>Write your post in HTML.</p>\n<h2>A subheading</h2>\n<p>Another paragraph with a <a href="https://example.com">link</a> and <strong>bold</strong> text.</p>'

export default function AdminBlog() {
  const [list, setList] = useState(null)   // null=loading, []=loaded, false=error
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('write')  // mobile preview toggle

  const load = useCallback(() => {
    api.posts.list(true).then((rows) => setList(rows || [])).catch(() => setList(false))
  }, [])
  useEffect(() => { load() }, [load])

  const startNew = () => { setForm({ ...EMPTY, date: today() }); setTab('write') }
  const startEdit = (p) => {
    setForm({
      _orig: p.slug, slug: p.slug, title: p.title || '', tag: p.tag || '', author: p.author || '',
      coverImage: p.coverImage || '', dek: p.dek || '', body: bodyToHtml(p.body),
      status: p.status || 'published',
      date: p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 10) : today(),
    })
    setTab('write')
  }

  async function save(publish) {
    if (!form.title.trim() || busy) return
    setBusy(true)
    const status = publish ? 'published' : form.status
    const payload = {
      slug: form.slug || slugify(form.title), title: form.title.trim(), tag: form.tag.trim(),
      author: form.author.trim(), coverImage: form.coverImage.trim(), dek: form.dek.trim(),
      body: form.body, status,
      publishedAt: status === 'published' ? (form.date ? Date.parse(form.date) : Date.now()) : null,
    }
    try {
      if (form._orig) await api.posts.update(form._orig, payload)
      else await api.posts.create(payload)
      setForm(null); load()
    } catch (e) { alert(e.message || 'Could not save the post') }
    finally { setBusy(false) }
  }
  async function remove(slug, title) {
    if (!confirm(`Delete “${title}”?`)) return
    try { await api.posts.remove(slug); load() } catch (e) { alert(e.message) }
  }

  if (list === false) {
    return (
      <div className="admin-empty">
        <p>The blog API isn’t reachable. Run <code>npm run dev</code> (which starts the local API) and make sure you’re signed in as an admin, then <button className="btn btn--soft" onClick={load}><RefreshCw size={14} /> retry</button>.</p>
      </div>
    )
  }

  // ── editor ──────────────────────────────────────────────────────────────────
  if (form) {
    const set = (p) => setForm({ ...form, ...p })
    return (
      <div className="blogcms">
        <div className="blogcms__bar">
          <strong className="blogcms__heading">{form._orig ? 'Edit post' : 'New post'}</strong>
          <span className="blogcms__spacer" />
          <button className="btn btn--soft" onClick={() => setForm(null)}><X size={15} /> Cancel</button>
          <button className="btn btn--soft" onClick={() => save(false)} disabled={!form.title.trim() || busy}><Save size={15} /> Save draft</button>
          <button className="btn btn--primary" onClick={() => save(true)} disabled={!form.title.trim() || busy}>{busy ? 'Saving…' : 'Publish'}</button>
        </div>

        <div className="blogcms__meta">
          <Field label="Title" value={form.title} full
            onChange={(v) => set({ title: v, slug: form._orig ? form.slug : slugify(v) })} placeholder="Why we travel region by region" />
          <Field label="Slug" value={form.slug} mono onChange={(v) => set({ slug: slugify(v) })} placeholder="travel-region-by-region" />
          <Field label="Tag" value={form.tag} onChange={(v) => set({ tag: v })} placeholder="Food / Planning / Field notes" />
          <Field label="Author" value={form.author} onChange={(v) => set({ author: v })} />
          <Field label="Date" type="date" value={form.date} onChange={(v) => set({ date: v })} />
          <ImageField label="Hero image" value={form.coverImage} full onChange={(v) => set({ coverImage: v })} />
          <Field label="Excerpt (shown on the blog index)" value={form.dek} full area onChange={(v) => set({ dek: v })} placeholder="One or two sentences." />
        </div>

        <div className="blogcms__toggle">
          <button className={tab === 'write' ? 'is-on' : ''} onClick={() => setTab('write')}><Code2 size={14} /> HTML</button>
          <button className={tab === 'preview' ? 'is-on' : ''} onClick={() => setTab('preview')}><Eye size={14} /> Preview</button>
        </div>

        <div className="blogcms__split">
          <div className={`blogcms__pane ${tab === 'write' ? '' : 'is-hidden-sm'}`}>
            <label className="blogcms__panelabel"><Code2 size={13} /> Body — raw HTML</label>
            <textarea className="blogcms__code" spellCheck={false} value={form.body}
              onChange={(e) => set({ body: e.target.value })} placeholder={PLACEHOLDER} />
            <p className="blogcms__hint">Plain HTML — e.g. <code>&lt;p&gt;</code>, <code>&lt;h2&gt;</code>, <code>&lt;ul&gt;&lt;li&gt;</code>, <code>&lt;a href&gt;</code>, <code>&lt;img&gt;</code>, <code>&lt;blockquote&gt;</code>.</p>
          </div>
          <div className={`blogcms__pane ${tab === 'preview' ? '' : 'is-hidden-sm'}`}>
            <label className="blogcms__panelabel"><Eye size={13} /> Live preview</label>
            <div className="blogcms__preview">
              {form.coverImage && <div className="blogcms__hero"><img src={form.coverImage} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} /></div>}
              {form.tag && <span className="post__tag">{form.tag}</span>}
              <h1 className="post__title blogcms__ptitle">{form.title || 'Untitled'}</h1>
              {form.dek && <p className="blogcms__pdek">{form.dek}</p>}
              <div className="post__body prose" dangerouslySetInnerHTML={{ __html: form.body || '<p style="opacity:.5">Your HTML renders here…</p>' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── list ────────────────────────────────────────────────────────────────────
  const posts = Array.isArray(list) ? list : []
  return (
    <div className="blogcms">
      <div className="admin__bar">
        <button className="btn btn--primary" onClick={startNew}><Plus size={16} /> New post</button>
        <Link to={paths.blog()} className="admin__view">View blog <ArrowUpRight size={14} /></Link>
      </div>

      {list === null ? <p className="admin-empty">Loading posts…</p> : posts.length === 0 ? (
        <p className="admin-empty">No posts yet. Hit <b>New post</b> to write your first one.</p>
      ) : (
        <ul className="admin-rows">
          {posts.map((p) => (
            <li key={p.slug} className="admin-row">
              {p.coverImage ? <img className="admin-row__thumb" src={p.coverImage} alt="" /> : <span className="admin-row__thumb admin-row__thumb--blank" />}
              <div className="admin-row__main">
                <span className="admin-row__title">{p.title} <span className={`blogcms__badge blogcms__badge--${p.status}`}>{p.status}</span></span>
                <span className="admin-row__meta">{p.tag} · {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('en-GB') : '—'} · /blog/{p.slug}</span>
              </div>
              {p.status === 'published' && <Link to={paths.post(p.slug)} className="admin-row__btn" title="View"><ArrowUpRight size={16} /></Link>}
              <button className="admin-row__btn" onClick={() => startEdit(p)} title="Edit"><Pencil size={15} /></button>
              <button className="admin-row__btn admin-row__btn--danger" onClick={() => remove(p.slug, p.title)} title="Delete"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
      <p className="admin-note">Posts are stored in the database. Published posts appear on the blog; drafts stay hidden.</p>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', full, mono, area }) {
  return (
    <label className={`admin-field ${full ? 'admin-field--full' : ''}`}>
      <span className="admin-field__label">{label}</span>
      {area
        ? <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={mono ? { fontFamily: 'var(--mono)' } : undefined} />}
    </label>
  )
}
