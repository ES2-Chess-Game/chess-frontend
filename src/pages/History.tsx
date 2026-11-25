import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CapturedPieces from '../components/CapturedPieces'
import GameHistoryList from '../components/GameHistoryList'
import MoveList from '../components/MoveList'
import { gameApi, readAiDifficulty } from '../gameCapabilities'
import { gameDate, gamePlayerName, gameStatusText, pieceSymbols, type PlayerColor, type SavedGame } from '../savedGame'

function MatchRecord({ game }: { game: SavedGame }) {
  const moves = game.lances ?? []
  const isAi = game.configuracao?.modo === 'ai'
  const level = isAi && game.configuracao?.dificuldade
    ? readAiDifficulty(game.configuracao.dificuldade).label
    : null

  return (
    <>
      <header className="history-heading">
        <h1>Partida encerrada</h1>
        <div className="history-meta">
          <span>{isAi ? 'Contra a IA' : 'Partida local'}{level && ` · ${level}`}</span>
          {game.encerradaEm != null && <time dateTime={new Date(game.encerradaEm).toISOString()}>{gameDate.format(game.encerradaEm)}</time>}
        </div>
      </header>
      <div className="history-match">
        <div className="history-report">
          <section className="history-result" aria-label="Resultado">
            {game.vencedor ? (
              <>
                <p className="eyebrow">{gameStatusText(game)}</p>
                <h2>Vitória de {gamePlayerName(game, game.vencedor)}</h2>
              </>
            ) : <h2>{gameStatusText(game)}</h2>}
            <dl className="history-players">
              {(['BRANCA', 'PRETA'] as const).map((color: PlayerColor) => (
                <div key={color}>
                  <dt>{color === 'BRANCA' ? 'Brancas' : 'Pretas'}</dt>
                  <dd>{gamePlayerName(game, color)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="history-moves" aria-label="Lances da partida">
            <div className="detail-heading"><h2>Lances</h2><span>{moves.length}</span></div>
            {moves.length ? <MoveList moves={moves} /> : <p className="muted">Nenhum lance registrado</p>}
          </section>
        </div>
        {game.tabuleiro && (
          <figure className="history-position">
            <figcaption>Posição final</figcaption>
            <CapturedPieces by="PRETA" moves={moves} />
            <div className="board history-board" role="img" aria-label="Tabuleiro com a posição final">
              {game.tabuleiro.flatMap((row, rank) => row.map((piece, file) => (
                <span aria-hidden="true" className={`opening-square ${(rank + file) % 2 ? 'dark' : 'light'}`} key={rank * 8 + file}>
                  {piece && (
                    <span className={`piece ${piece.cor === 'BRANCA' ? 'white-piece' : 'black-piece'}`}>
                      {pieceSymbols[piece.tipo]}
                    </span>
                  )}
                </span>
              )))}
            </div>
            <CapturedPieces by="BRANCA" moves={moves} />
          </figure>
        )}
      </div>
      <Link className="button-secondary history-play" to={isAi ? '/difficulty' : '/local'}>Nova partida</Link>
    </>
  )
}

function HistoryContent({ id }: { id?: string }) {
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
    <main id="conteudo" tabIndex={-1} className="page history-page">
      <Link className="back-link" to={id ? '/historico' : '/'}>← {id ? 'Histórico' : 'Modos de jogo'}</Link>
      {!game && <h1>{id ? 'Partida encerrada' : 'Histórico de partidas'}</h1>}
      {error && <p className="error-message" role="alert">Histórico indisponível</p>}
      {!error && !games && <p className="muted" role="status">Carregando partidas</p>}
      {games?.length === 0 && <p className="muted">Nenhuma partida encerrada ainda</p>}
      {games && !id && <GameHistoryList games={games} />}
      {game && <MatchRecord game={game} />}
    </main>
  )
}

export default function History() {
  const { id } = useParams()
  return <HistoryContent key={id} id={id} />
}
