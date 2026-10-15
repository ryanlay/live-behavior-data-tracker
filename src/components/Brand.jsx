const logoSrc = `${import.meta.env.BASE_URL}tcfdlogo.png`

// TCFD logo tile. Falls back to a text wordmark if the image file is missing.
export default function Brand({ size = 'md' }) {
  return (
    <img
      className={`brand-logo brand-logo-${size}`}
      src={logoSrc}
      alt="The Center For Discovery"
      onError={(event) => {
        const fallback = document.createElement('span')
        fallback.className = 'brand-wordmark'
        fallback.textContent = 'The Center For Discovery'
        event.currentTarget.replaceWith(fallback)
      }}
    />
  )
}
