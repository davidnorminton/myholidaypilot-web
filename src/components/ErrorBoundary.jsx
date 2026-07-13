import { Component } from 'react'

// Route-level error containment: one broken component blanks its section,
// not the whole SPA. Errors log to the console (visible in DevTools and in
// Vercel function logs when SSR'd — which this app isn't, so console only).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) { return { error } }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.name || 'section', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="errbound wrap">
          <h2>Something went wrong{this.props.name ? ` in ${this.props.name}` : ''}.</h2>
          <p>The rest of the site is fine — try reloading this page. If it keeps happening, it's on us, not you.</p>
          <button className="btn btn--primary" onClick={() => { this.setState({ error: null }); window.location.reload() }}>
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
