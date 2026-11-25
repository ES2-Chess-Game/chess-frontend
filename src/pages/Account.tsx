import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom'
import { AccountRequestError, apiRequest, type Account, type Profile, type Session } from '../account'
import AccountForm from '../components/AccountForm'
import AvatarIcon from '../components/AvatarIcon'
import GameHistoryList from '../components/GameHistoryList'
import ProfileEditor from '../components/ProfileEditor'
import { gameApi, useGameCapabilities } from '../gameCapabilities'
import type { SavedGame } from '../savedGame'

function AccountProfile({ account, onUpdate, onSignOut }: {
  account: Account
  onUpdate: (profile: Account) => void
  onSignOut: () => void
}) {
  const capabilities = useGameCapabilities()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [recent, setRecent] = useState<SavedGame[] | null>(null)
  const [gamesError, setGamesError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [accountError, setAccountError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    void apiRequest<Profile>('/api/perfil', { signal })
      .then(value => { if (!signal.aborted) setProfile(value) })
      .catch(error => {
        if (!signal.aborted) setAccountError(error instanceof Error ? error.message : 'Perfil indisponível')
      })

    void apiRequest<SavedGame[]>(`${gameApi}/historico?resumo=true`, { signal })
      .then(history => { if (!signal.aborted) setRecent(history.slice(0, 5)) })
      .catch(() => { if (!signal.aborted) setGamesError(true) })

    return () => controller.abort()
  }, [])

  async function signOut() {
    setSigningOut(true)
    setAccountError('')
    try {
      await apiRequest<void>('/api/auth/logout', { method: 'POST' })
      onSignOut()
    } catch (error) {
      if (error instanceof AccountRequestError && error.status === 401) {
        onSignOut()
        return
      }
      setAccountError('Não foi possível sair da conta')
    } finally {
      setSigningOut(false)
    }
  }

  const identity = profile ?? account

  return (
    <>
      <h1>Meu perfil</h1>
      <div className="profile-layout">
        <section className="profile-section" aria-label="Dados da conta">
          <div className="profile-identity">
            <AvatarIcon avatar={identity.avatar} />
            <div>
              <h2>{identity.username}</h2>
              <p className="muted">{identity.email}</p>
            </div>
          </div>
          {accountError && <p role="alert" className="error-message">{accountError}</p>}
          {editing && profile ? (
            <ProfileEditor profile={profile} onCancel={() => setEditing(false)} onSave={updated => {
              setProfile(updated)
              onUpdate(updated)
              setEditing(false)
            }} />
          ) : (
            <div className="action-buttons">
              {profile && <button className="button-secondary" onClick={() => setEditing(true)}>Editar perfil</button>}
              <button className="button-secondary" disabled={signingOut} onClick={() => void signOut()}>Sair da conta</button>
            </div>
          )}
        </section>
        <section className="profile-section" aria-labelledby="profile-games">
          <h2 id="profile-games">Suas partidas</h2>
          {capabilities?.perfilComEstatisticas && profile?.estatisticas && (
            <div className="profile-results">
              <h3>Contra a IA</h3>
              <dl>
                <div><dt>Vitórias</dt><dd>{profile.estatisticas.vitorias}</dd></div>
                <div><dt>Derrotas</dt><dd>{profile.estatisticas.derrotas}</dd></div>
                <div><dt>Empates</dt><dd>{profile.estatisticas.empates}</dd></div>
              </dl>
            </div>
          )}
          {gamesError && <p className="error-message" role="alert">Não foi possível carregar todas as partidas</p>}
          {!gamesError && recent === null && <p className="muted" role="status">Carregando partidas</p>}
          {recent?.length === 0 && <p className="muted">Nenhuma partida encerrada ainda</p>}
          {!!recent?.length && <GameHistoryList games={recent} />}
          <Link className="back-link" to="/historico">Ver histórico completo</Link>
        </section>
      </div>
    </>
  )
}

export default function AccountPage({ session, onChange }: {
  session: Session
  onChange: (session: Session) => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from

  function signIn(account: Account) {
    onChange({ status: 'signed-in', account })
    if (from) void navigate(from, { replace: true, state: from.state })
  }

  return (
    <main id="conteudo" tabIndex={-1} className="page account-page">
      <Link className="back-link" to="/">← Modos de jogo</Link>
      {session.status === 'loading' && <p className="muted" role="status">Consultando sessão</p>}
      {session.status === 'unavailable' && <h1>Conta indisponível</h1>}
      {session.status === 'guest' && <AccountForm onSignIn={signIn} continuingGame={!!from && from.pathname !== '/historico'} />}
      {session.status === 'signed-in' && (
        <AccountProfile
          key={session.account.id}
          account={session.account}
          onUpdate={account => onChange({ status: 'signed-in', account })}
          onSignOut={() => onChange({ status: 'guest' })}
        />
      )}
    </main>
  )
}
