import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AiIcon from '../components/AiIcon'
import { gameApi, useGameCapabilities } from '../gameCapabilities'
import { isFinished, resumeGameUrl, type SavedGame } from '../savedGame'

const opening = [
  '♜♞♝♛♚♝♞♜',
  '♟♟ ♟♟♟♟♟',
  '        ',
  '  ♟     ',
  '    ♟   ',
  '        ',
  '♟♟♟♟ ♟♟♟',
  '♜♞♝♛♚♝♞♜',
]

function OpeningBoard() {
  return (
    <figure className="opening" aria-label="Tabuleiro após os lances e4 e c5">
      <div className="opening-grid" aria-hidden="true">
        {opening.flatMap((rank, row) => Array.from(rank, (piece, col) => (
          <span
            className={`opening-square ${(row + col) % 2 ? 'dark' : 'light'} ${row === 4 && col === 4 ? 'opening-last' : ''}`}
            key={row * 8 + col}
          >
            {piece !== ' ' && <span className={`piece ${row < 4 ? 'black-piece' : 'white-piece'}`}>{piece}</span>}
          </span>
        )))}
      </div>
      <figcaption><span>Defesa siciliana</span><span>1. e4 c5</span></figcaption>
    </figure>
  )
}

export default function Home({ signedIn }: { signedIn: boolean }) {
  const capabilities = useGameCapabilities()
  const [resume, setResume] = useState<SavedGame | null>(null)
  const canResume = signedIn && capabilities?.partidasPersistentes === true

  useEffect(() => {
    if (!canResume) return
    const controller = new AbortController()
    void fetch(`${gameApi}/em-andamento`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) return
        const game = await response.json() as SavedGame
        if (!controller.signal.aborted) setResume(isFinished(game) ? null : game)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [canResume])

  return (
    <main id="conteudo" tabIndex={-1} className="page home">
      <div className="home-copy">
        <p className="eyebrow">Nova partida</p>
        <h1>Acha que tem moral para enfrentar a <em>Skynet</em>?</h1>
        <p className="intro">Enfrente a inteligência artificial ou jogue contra outra pessoa no mesmo tabuleiro.</p>

        <nav className="menu-options" aria-label="Modos de jogo">
          <Link className="mode-link mode-primary" to="/local">
            <span className="mode-symbol" aria-hidden="true">♟</span>
            <span><strong>Jogar localmente</strong><small>Duas pessoas, um tabuleiro</small></span>
            <span className="mode-arrow" aria-hidden="true">↗</span>
          </Link>
          <Link className="mode-link mode-ai" to="/difficulty">
            <AiIcon />
            <span><strong>Desafiar a IA</strong><small>Encare a Skynet em três níveis</small></span>
            <span className="mode-arrow" aria-hidden="true">↗</span>
          </Link>
          {canResume && (
            <div className="saved-game-links">
              {resume && <Link className="back-link" to={resumeGameUrl(resume)}>Retomar partida</Link>}
              <Link className="back-link" to="/historico">Ver histórico</Link>
            </div>
          )}
        </nav>
      </div>
      <OpeningBoard />
    </main>
  )
}
