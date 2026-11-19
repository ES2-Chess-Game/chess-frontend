import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <header className="topbar">
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', color: 'inherit' }}>
        <div className="brand-mark">♞</div>
        <div>
          <strong>Clube 64</strong>
          <span>arena de xadrez</span>
        </div>
      </Link>
      <div className="topbar-meta">
        <span className="live-dot" /> partida local <span className="profile">G8</span>
      </div>
    </header>
  )
}