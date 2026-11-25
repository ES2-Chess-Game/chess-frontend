import { capturedPiece, pieceLabel, pieceSymbols, savedMoveText, type SavedMove } from '../savedGame'

export default function MoveList({ moves }: { moves: SavedMove[] }) {
  return (
    <ol className="move-list">
      {moves.map((move, index) => {
        const capture = capturedPiece(move, index)
        return (
          <li key={index}>
            {savedMoveText(move)}
            {capture && (
              <span className="move-capture" role="img" aria-label={`Captura: ${pieceLabel(capture.type, capture.color)}`}>
                {pieceSymbols[capture.type]}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
