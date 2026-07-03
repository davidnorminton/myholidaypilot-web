// The site mark: compass globe with plane and landmarks (transparent PNG).
export default function Logo({ size = 28, className = '' }) {
  return (
    <img src={`${import.meta.env.BASE_URL}logo.png`} width={size} height={size}
      className={className} alt="" aria-hidden="true" draggable="false" />
  )
}
