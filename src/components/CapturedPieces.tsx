import { capturedPiece, pieceLabel, pieceSymbols, type PlayerColor, type SavedMove } from '../savedGame'

export default function CapturedPieces({ by, moves }: { by: PlayerColor; moves: SavedMove[] }) {
  const label = by === 'BRANCA' ? 'Capturas das brancas' : 'Capturas das pretas'
  const captures = moves.flatMap((move, index) => {
    const capture = capturedPiece(move, index)
    return capture && capture.by === by ? [capture] : []
  })

  return (
    <div className="capture-tray" role="group" aria-label={label}>
      <span className="capture-label">{label}</span>
      <span className="capture-pieces">
        {captures.length ? captures.map(({ type, color }, index) => (
          <span className={`captured-piece ${color === 'BRANCA' ? 'white-piece' : 'black-piece'}`}
            key={index} role="img" aria-label={pieceLabel(type, color)}>{pieceSymbols[type]}</span>
        )) : <span className="capture-empty">Nenhuma</span>}
      </span>
    </div>
  )
}
