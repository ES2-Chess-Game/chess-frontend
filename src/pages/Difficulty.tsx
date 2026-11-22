import { Link } from 'react-router-dom'

export default function Difficulty() {
  return (
    <main id="conteudo" tabIndex={-1} className="page difficulty">
      <Link className="back-link" to="/">← Modos de jogo</Link>
      <p className="eyebrow">Contra a máquina</p>
      <h1>Escolha o nível</h1>
      <p className="intro">Você joga com as brancas. O Minimax responde com as pretas.</p>

      <ul className="level-list">
        <li>
          <Link className="mode-link mode-primary" to="/game?mode=ai&level=1">
            <span className="level-number" aria-hidden="true">01</span>
            <span><strong>Básico</strong><small>Começar uma partida</small></span>
            <span className="mode-arrow" aria-hidden="true">↗</span>
          </Link>
        </li>
        <li className="level-unavailable">
          <span className="level-number" aria-hidden="true">02</span>
          <strong>Intermediário</strong><span>Em breve</span>
        </li>
        <li className="level-unavailable">
          <span className="level-number" aria-hidden="true">03</span>
          <strong>Avançado</strong><span>Em breve</span>
        </li>
      </ul>
    </main>
  )
}
