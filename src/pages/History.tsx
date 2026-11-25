import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { gameApi } from '../gameCapabilities'
import { gameDate, gameResult, type SavedGame } from '../savedGame'
import GameHistoryList from '../components/GameHistoryList'
import MoveList from '../components/MoveList'

function HistoryContent() {
  const { id } = useParams()
  const [games, setGames] = useState<SavedGame[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void fetch(`${gameApi}/historico${id ? `/${encodeURIComponent(id)}` : '?resumo=true'}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error()
        const data = await response.json() as SavedGame | SavedGame[]
        if (!controller.signal.aborted) setGames(Array.isArray(data) ? data : [data])
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [id])

  const game = id ? games?.[0] : undefined

  return (
    <main id="conteudo" tabIndex={-1} className="page setup-page">
      <Link className="back-link" to={id ? '/historico' : '/'}>← {id ? 'Histórico' : 'Modos de jogo'}</Link>
      <h1>{id ? 'Partida encerrada' : 'Histórico de partidas'}</h1>
      {error && <p className="error-message" role="alert">Histórico indisponível</p>}
      {!error && !games && <p className="muted" role="status">Carregando partidas</p>}
      {games?.length === 0 && <p className="muted">Nenhuma partida encerrada ainda</p>}
      {games && !id && <GameHistoryList games={games} />}
      {game && (
        <section className="setup-form" aria-label="Lances da partida">
          <div>
            <strong>{gameResult(game)}</strong>
            {game.encerradaEm && <p className="muted">{gameDate.format(game.encerradaEm)}</p>}
          </div>
          {game.lances?.length
            ? <MoveList moves={game.lances} />
            : <p className="muted">Nenhum lance registrado</p>}
        </section>
      )}
    </main>
  )
}

export default function History() {
  const { id } = useParams()
  return <HistoryContent key={id} />
}
