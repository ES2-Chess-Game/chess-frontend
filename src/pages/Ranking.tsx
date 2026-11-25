import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest, type Avatar } from '../account'
import AvatarIcon from '../components/AvatarIcon'
import { gameApi } from '../gameCapabilities'

type RankingEntry = {
  username: string
  avatar: Avatar | null
  vitorias: number
  derrotas: number
  empates: number
  pontos: number
}

export default function Ranking({ currentUser }: { currentUser?: string }) {
  const [result, setResult] = useState<RankingEntry[] | 'loading' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    void apiRequest<RankingEntry[]>(`${gameApi}/ranking`, { signal })
      .then(entries => { if (!signal.aborted) setResult(entries) })
      .catch(() => { if (!signal.aborted) setResult('error') })
    return () => controller.abort()
  }, [attempt])

  return (
    <main id="conteudo" tabIndex={-1} className="page account-page ranking-page">
      <Link to="/" className="back-link">← Modos de jogo</Link>
      <h1>Ranking do Skynet Chess</h1>
      <p className="muted" id="ranking-regras">
        Contra a IA, cada vitória por xeque-mate vale 3 pontos e cada empate vale 1. Quem tem menos derrotas leva
        vantagem no empate em pontos
      </p>
      {result === 'loading' && <p role="status" className="muted">Carregando ranking</p>}
      {result === 'error' && (
        <>
          <p role="alert" className="error-message">Não foi possível carregar o ranking</p>
          <button className="button-secondary" onClick={() => {
            setResult('loading')
            setAttempt(current => current + 1)
          }}>Tentar novamente</button>
        </>
      )}
      {Array.isArray(result) && (result.length ? (
        <table className="ranking-table" aria-label="Classificação geral" aria-describedby="ranking-regras">
          <thead>
            <tr>
              <th scope="col" aria-label="Posição">#</th>
              <th scope="col">Jogador</th>
              <th scope="col" aria-label="Vitórias por xeque-mate">V</th>
              <th scope="col" aria-label="Empates">E</th>
              <th scope="col" aria-label="Derrotas">D</th>
              <th scope="col">Pts</th>
            </tr>
          </thead>
          <tbody>{result.map((entry, index) => (
            <tr key={entry.username} className={entry.username === currentUser ? 'ranking-current' : undefined}>
              <td>{index + 1}</td>
              <th scope="row">
                <span className="ranking-player">
                  <AvatarIcon avatar={entry.avatar} />
                  <span>{entry.username}{entry.username === currentUser && <small>Você</small>}</span>
                </span>
              </th>
              <td>{entry.vitorias}</td><td>{entry.empates}</td><td>{entry.derrotas}</td>
              <td><strong>{entry.pontos}</strong></td>
            </tr>
          ))}</tbody>
        </table>
      ) : <p className="muted">Ainda não há jogadores cadastrados</p>)}
    </main>
  )
}
