import { Link } from 'react-router-dom'

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

export default function Home() {
  return (
    <main id="conteudo" tabIndex={-1} className="page home">
      <div className="home-copy">
        <p className="eyebrow">Nova partida</p>
        <h1>O tabuleiro<br />é seu.</h1>
        <p className="intro">Jogue com alguém no mesmo dispositivo ou desafie o Minimax.</p>

        <nav className="menu-options" aria-label="Modos de jogo">
          <Link className="mode-link mode-primary" to="/game">
            <span className="mode-symbol" aria-hidden="true">♟</span>
            <span><strong>Jogar localmente</strong><small>Duas pessoas, um tabuleiro</small></span>
            <span className="mode-arrow" aria-hidden="true">↗</span>
          </Link>
          <Link className="mode-link" to="/difficulty">
            <span className="mode-symbol" aria-hidden="true">♞</span>
            <span><strong>Jogar contra a máquina</strong><small>Pratique com o Minimax</small></span>
            <span className="mode-arrow" aria-hidden="true">↗</span>
          </Link>
        </nav>
      </div>
      <OpeningBoard />
    </main>
  )
}
