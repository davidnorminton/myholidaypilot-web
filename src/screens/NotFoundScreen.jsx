import { Link } from 'react-router-dom'
import { paths } from '../lib/paths.js'

export default function NotFoundScreen() {
  return (
    <div className="page wrap" style={{ textAlign: 'center', paddingTop: 80 }}>
      <h1 className="sub-hero__title">Lost the trail</h1>
      <p className="empty">That page doesn’t exist.</p>
      <Link to={paths.home()} className="btn btn--primary" style={{ display: 'inline-flex' }}>Back home</Link>
    </div>
  )
}
