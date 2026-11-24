import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Session } from '../account'

export default function RequireAccount({ session }: { session: Session }) {
  const location = useLocation()
  if (session.status === 'signed-in') return <Outlet />
  if (session.status === 'guest') return <Navigate to="/conta" replace state={{ from: location }} />

  return (
    <main id="conteudo" tabIndex={-1} className="page account-page">
      {session.status === 'loading'
        ? <p className="muted" role="status">Consultando sessão</p>
        : <>
          <h1>Não foi possível consultar sua sessão</h1>
          <button className="button-secondary" onClick={() => window.location.reload()}>Tentar novamente</button>
          <Link className="back-link" to="/">Voltar ao início</Link>
        </>}
    </main>
  )
}
