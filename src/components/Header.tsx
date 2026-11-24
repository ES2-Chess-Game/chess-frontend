import { Link } from 'react-router-dom'
import type { Session } from '../account'
import AvatarIcon from './AvatarIcon'

export default function Header({ session }: { session: Session }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand" aria-label="Clube 64, início">
          <span className="brand-mark" aria-hidden="true">♞</span>
          <span>Clube <strong>64</strong></span>
        </Link>
        <nav className="site-nav" aria-label="Navegação principal">
          <Link to="/ranking" className="account-link">Ranking</Link>
          {(session.status === 'guest' || session.status === 'signed-in') && (
            <Link to="/conta" className="account-link">
              {session.status === 'signed-in' && <AvatarIcon avatar={session.account.avatar} />}
              {session.status === 'signed-in' ? 'Meu perfil' : 'Entrar'}
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
