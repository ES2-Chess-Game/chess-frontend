import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { gameApi } from '../gameCapabilities'
import { savedMoveText, type SavedGame } from '../savedGame'

const results: Record<string, string> = {
  XEQUE_MATE: 'Xeque-mate', EMPATE: 'Empate', TEMPO_ESGOTADO: 'Tempo esgotado', DESISTENCIA: 'Desistência',
}
const formatDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function result(game: SavedGame) {
  const winner = game.vencedor === 'BRANCA'
    ? game.configuracao?.brancas || 'Brancas'
    : game.configuracao?.pretas || (game.configuracao?.modo === 'ai' ? 'IA' : 'Pretas')
  return [results[game.status], game.vencedor && `Vitória · ${winner}`].filter(Boolean).join(' · ')
}

function HistoryContent() {
  const { id } = useParams()
  const [games, setGames] = useState<SavedGame[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void fetch(`${gameApi}/historico${id ? `/${encodeURIComponent(id)}` : ''}`, { signal: controller.signal })
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
      {games && !id && (
        <ul className="level-list">
          {games.map(item => (
            <li key={item.id}>
              <Link className="mode-link history-link" to={`/historico/${item.id}`}>
                <span>
                  <strong>{result(item)}</strong>
                  <small>{item.encerradaEm && formatDate.format(item.encerradaEm)}</small>
                </span>
                <span className="mode-arrow" aria-hidden="true">↗</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {game && (
        <section className="setup-form" aria-label="Lances da partida">
          <div>
            <strong>{result(game)}</strong>
            {game.encerradaEm && <p className="muted">{formatDate.format(game.encerradaEm)}</p>}
          </div>
          {game.lances?.length
            ? <ol className="move-list">{game.lances.map((move, index) => <li key={index}>{savedMoveText(move)}</li>)}</ol>
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
