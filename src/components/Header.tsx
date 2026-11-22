import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand" aria-label="Clube 64, início">
          <span className="brand-mark" aria-hidden="true">♞</span>
          <span>Clube <strong>64</strong></span>
        </Link>
        <span className="site-credit">ES2 · Grupo 8</span>
      </div>
    </header>
  )
}
