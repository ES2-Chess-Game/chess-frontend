import { Link } from 'react-router-dom'
import { gameDate, gameResult, historyGameUrl, type SavedGame } from '../savedGame'

export default function GameHistoryList({ games }: { games: SavedGame[] }) {
  return (
    <ul className="history-list">
      {games.map(game => (
        <li key={game.id}>
          <Link className="mode-link history-link" to={historyGameUrl(game.id)}>
            <span>
              <small>{game.configuracao?.modo === 'ai' ? 'Contra a IA' : 'Partida local'}</small>
              <strong>{gameResult(game)}</strong>
            </span>
            {game.encerradaEm != null && (
              <time dateTime={new Date(game.encerradaEm).toISOString()}>{gameDate.format(game.encerradaEm)}</time>
            )}
            <span className="mode-arrow" aria-hidden="true">↗</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
