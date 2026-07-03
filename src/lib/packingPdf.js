// A dedicated, printable packing-list PDF — same paper-and-gold language as
// the trip PDF. Checked items print with a tick; unchecked get an empty box
// to tick with a pen.
const safeText = (t) => String(t ?? '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2014/g, '-').replace(/\u00b7/g, '-')

export async function downloadPackingPdf(trip) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 52
  let y = 64

  const paper = () => { doc.setFillColor(247, 246, 242); doc.rect(0, 0, W, H, 'F') }
  paper()

  const footer = () => {
    const n = doc.internal.getNumberOfPages()
    for (let i = 1; i <= n; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 144, 134)
      doc.text('myholidaypilot', M, H - 28)
      doc.text(`${i} / ${n}`, W - M, H - 28, { align: 'right' })
    }
  }
  const need = (h) => { if (y + h > H - 60) { doc.addPage(); paper(); y = 64 } }

  // header
  doc.setFont('times', 'normal'); doc.setFontSize(26); doc.setTextColor(42, 38, 33)
  doc.text('Packing list', M, y)
  y += 20
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(122, 116, 106)
  const p = trip.packing
  const meta = [
    safeText(trip.name),
    trip.startDate ? `${trip.startDate} - ${trip.endDate || trip.startDate}` : '',
    `${p.adults} adult${p.adults === 1 ? '' : 's'}${p.children ? `, ${p.children} child${p.children === 1 ? '' : 'ren'}` : ''}`,
  ].filter(Boolean).join('   ·   ')
  doc.text(safeText(meta), M, y)
  y += 12
  doc.setDrawColor(169, 118, 42); doc.setLineWidth(1.2); doc.line(M, y, W - M, y)
  y += 26

  // categories in two columns where they fit naturally (simple flow: one col,
  // categories keep together when short)
  for (const cat of p.categories) {
    need(40 + Math.min(cat.items.length, 4) * 17)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(169, 118, 42)
    doc.text(safeText(cat.name).toUpperCase(), M, y, { charSpace: 1.4 })
    y += 16
    for (const it of cat.items) {
      const wrapped = doc.splitTextToSize(safeText(it.text), W - M * 2 - 26)
      need(wrapped.length * 13 + 5)
      doc.setDrawColor(122, 116, 106); doc.setLineWidth(1)
      doc.rect(M, y - 7.5, 9, 9)
      if (it.done) {
        doc.setDrawColor(31, 111, 84); doc.setLineWidth(1.4)
        doc.line(M + 1.8, y - 3.2, M + 3.8, y - 0.8)
        doc.line(M + 3.8, y - 0.8, M + 7.4, y - 6)
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5)
      doc.setTextColor(it.done ? 150 : 70, it.done ? 144 : 66, it.done ? 134 : 59)
      doc.text(wrapped, M + 16, y)
      y += wrapped.length * 13 + 4
    }
    y += 10
  }

  footer()
  doc.save(`${safeText(trip.name).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-packing-list.pdf`)
}
