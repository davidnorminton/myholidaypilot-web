// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { bodyToHtml, normalize } from '../src/lib/blogStore.js'

describe('bodyToHtml (XSS)', () => {
  it('strips script tags', () => {
    expect(bodyToHtml('<p>hi</p><script>alert(1)</script>')).not.toContain('<script')
  })
  it('strips event handlers', () => {
    expect(bodyToHtml('<img src=x onerror=alert(1)>')).not.toContain('onerror')
  })
  it('keeps honest markup', () => {
    const out = bodyToHtml('<p>Ciao <b>bella</b></p>')
    expect(out).toContain('<b>bella</b>')
  })
  it('wraps paragraph arrays', () => {
    expect(bodyToHtml(['one', 'two'])).toBe('<p>one</p>\n<p>two</p>')
  })
})

describe('normalize', () => {
  it('keeps the single tag and derives a date', () => {
    const n = normalize({ slug: 's', title: 't', tag: 'Food', publishedAt: Date.UTC(2026, 0, 5) })
    expect(n.tag).toBe('Food')
    expect(n.date).toBe('2026-01-05')
  })
})
