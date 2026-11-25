import { Link } from 'react-router-dom'
import type { Session } from '../account'
import AvatarIcon from './AvatarIcon'

export default function Header({ session }: { session: Session }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand" aria-label="Skynet Chess, início">
          <img className="brand-mark" src="/favicon.svg" width={36} height={36} alt="" />
          <span>Skynet <strong>Chess</strong></span>
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
