import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { api } from '../lib/api.js'

// A small "Upload" button that saves an image to public/images and returns its URL.
export default function UploadButton({ onUploaded, className = '', size = 14 }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try { const { url } = await api.upload(file); onUploaded(url) }
    catch (err) { alert(err.message || 'Upload failed') }
    finally { setBusy(false) }
  }

  return (
    <>
      <button type="button" className={`btn btn--soft ${className}`} onClick={() => ref.current?.click()} disabled={busy}>
        <Upload size={size} /> {busy ? 'Uploading…' : 'Upload'}
      </button>
      <input ref={ref} type="file" accept="image/*" hidden onChange={onFile} />
    </>
  )
}
