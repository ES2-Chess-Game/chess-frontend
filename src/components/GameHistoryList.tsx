import { Link } from 'react-router-dom'
import { gameDate, gameResult, type SavedGame } from '../savedGame'

export default function GameHistoryList({ games }: { games: SavedGame[] }) {
  return (
    <ul className="level-list">
      {games.map(game => (
        <li key={game.id}>
          <Link className="mode-link" to={`/historico/${game.id}`}>
            <span>
              <strong>{gameResult(game)}</strong>
              {game.encerradaEm && <small>{gameDate.format(game.encerradaEm)}</small>}
            </span>
            <span className="mode-arrow" aria-hidden="true">↗</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
