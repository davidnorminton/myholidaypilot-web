// A generic, on-brand placeholder for places without a photo. Designed to sit
// comfortably beside real photos in a grid: a warm gradient tinted by the region
// accent, with a soft compass + topographic-contour motif that reads as
// "map / travel" rather than "missing image". Pure SVG — no load cost, no
// licensing, scales crisply, and looks intentional next to photographs.
export default function PlacePlaceholder({ className = '' }) {
  return (
    <div className={`placeph ${className}`} aria-hidden>
      <svg className="placeph__art" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" role="img">
        {/* soft topographic contour lines */}
        <g className="placeph__lines" fill="none" strokeWidth="1.5">
          <path d="M-20 140 C 40 110, 90 150, 150 120 S 260 90, 330 130" />
          <path d="M-20 165 C 50 140, 100 175, 160 148 S 270 120, 330 158" />
          <path d="M-20 115 C 30 90, 100 120, 150 95 S 250 70, 330 100" />
        </g>
        {/* compass rose */}
        <g className="placeph__compass" transform="translate(150 92)">
          <circle r="30" fill="none" strokeWidth="1.5" />
          <circle r="22" fill="none" strokeWidth="1" opacity="0.5" />
          <path d="M0 -34 L6 0 L0 34 L-6 0 Z" className="placeph__needle" />
          <path d="M-34 0 L0 6 L34 0 L0 -6 Z" className="placeph__needle" opacity="0.55" />
          <circle r="3.2" className="placeph__hub" />
        </g>
      </svg>
    </div>
  )
}
