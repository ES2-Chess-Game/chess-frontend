import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

type Color = 'BRANCA' | 'PRETA'
type PieceType = 'PEAO' | 'TORRE' | 'CAVALO' | 'BISPO' | 'RAINHA' | 'REI'
type GameStatus = 'EM_ANDAMENTO' | 'XEQUE' | 'XEQUE_MATE' | 'EMPATE'
type Piece = { tipo: PieceType; cor: Color }
type Board = (Piece | null)[][]
type Game = { id: string; tabuleiro: Board; turnoAtual: Color; status: GameStatus; vencedor?: Color | null }
type Move = { from: [number, number]; to: [number, number]; captured: boolean }

const API_URL = '/api/partidas'
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const symbols: Record<PieceType, string> = {
  REI: '♚', RAINHA: '♛', TORRE: '♜', BISPO: '♝', CAVALO: '♞', PEAO: '♟',
}
const pieceNames: Record<PieceType, string> = {
  REI: 'rei', RAINHA: 'rainha', TORRE: 'torre', BISPO: 'bispo', CAVALO: 'cavalo', PEAO: 'peão',
}
const rows = [8, 7, 6, 5, 4, 3, 2, 1]

function squareLabel(row: number, col: number, piece: Piece | null) {
  const square = `${files[col]}${8 - row}`
  if (!piece) return `${square}, vazia`
  const female = piece.tipo === 'RAINHA' || piece.tipo === 'TORRE'
  const color = piece.cor === 'BRANCA' ? (female ? 'branca' : 'branco') : (female ? 'preta' : 'preto')
  return `${square}, ${pieceNames[piece.tipo]} ${color}`
}

async function readGame(response: Response): Promise<Game> {
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'erro' in data && typeof data.erro === 'string'
      ? data.erro
      : 'Não foi possível atualizar a partida.'
    throw new Error(message)
  }
  if (
    typeof data !== 'object' || data === null ||
    !('id' in data) || typeof data.id !== 'string' ||
    !('tabuleiro' in data) || !Array.isArray(data.tabuleiro) ||
    !('turnoAtual' in data) || (data.turnoAtual !== 'BRANCA' && data.turnoAtual !== 'PRETA') ||
    !('status' in data) || !['EM_ANDAMENTO', 'XEQUE', 'XEQUE_MATE', 'EMPATE'].includes(String(data.status))
  ) {
    throw new Error('O servidor retornou um estado de partida inválido.')
  }
  return data as Game
}

function describeMove(move: Move) {
  const [fromRow, fromCol] = move.from
  const [toRow, toCol] = move.to
  return `${files[fromCol]}${8 - fromRow} → ${files[toCol]}${8 - toRow}${move.captured ? ' ×' : ''}`
}

function findMove(before: Board, after: Board, color: Color): Move | null {
  const origins: [number, number][] = []
  const destinations: [number, number][] = []

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const previous = before[row][col]
      const current = after[row][col]
      if (previous?.cor === color && (!current || current.cor !== color)) origins.push([row, col])
      if (current?.cor === color && (!previous || previous.cor !== color || previous.tipo !== current.tipo)) {
        destinations.push([row, col])
      }
    }
  }

  for (const from of origins) {
    const [fromRow, fromCol] = from
    const movedPiece = before[fromRow][fromCol]
    const to = destinations.find(([toRow, toCol]) => after[toRow][toCol]?.tipo === movedPiece?.tipo)
    if (!to) continue

    const [toRow, toCol] = to
    const enPassantCapture = movedPiece?.tipo === 'PEAO' &&
      fromCol !== toCol &&
      before[toRow][toCol] === null &&
      before[fromRow][toCol]?.cor !== movedPiece.cor
    return { from, to, captured: before[toRow][toCol] !== null || enPassantCapture }
  }

  return null
}

function GamePage() {
  const [searchParams] = useSearchParams()
  const isAiGame = searchParams.get('mode') === 'ai'
  const [game, setGame] = useState<Game | null>(null)
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [focused, setFocused] = useState(52)
  const squares = useRef<(HTMLButtonElement | null)[]>([])
  const [moves, setMoves] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const mounted = useRef(false)

  const createGame = async () => {
    setLoading(true)
    setError('')
    setSelected(null)
    setFocused(52)
    setMoves([])
    setGame(null)
    try {
      const response = await fetch(API_URL, { method: 'POST' })
      setGame(await readGame(response))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Servidor indisponível.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (mounted.current) return
    mounted.current = true
    void createGame()
  }, [])

  const playAiMove = async (currentGame: Game) => {
    setLoading(true)
    setAiThinking(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/${currentGame.id}/ia`, { method: 'POST' })
      const updatedGame = await readGame(response)
      const aiMove = findMove(currentGame.tabuleiro, updatedGame.tabuleiro, 'PRETA')
      setGame(updatedGame)
      if (aiMove) setMoves((current) => [...current, describeMove(aiMove)])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível obter o lance da IA.')
    } finally {
      setAiThinking(false)
      setLoading(false)
    }
  }

  const play = async (row: number, col: number) => {
    if (!game || loading || game.status === 'XEQUE_MATE' || game.status === 'EMPATE' || (isAiGame && game.turnoAtual !== 'BRANCA')) return
    const piece = game.tabuleiro[row][col]
    if (!selected) {
      if (!piece || piece.cor !== game.turnoAtual) {
        setError(`Selecione uma peça ${game.turnoAtual === 'BRANCA' ? 'branca' : 'preta'} para jogar.`)
        return
      }
      setError('')
      setSelected([row, col])
      return
    }
    if (selected[0] === row && selected[1] === col) {
      setSelected(null)
      return
    }

    const from = selected
    const captured = game.tabuleiro[row][col] !== null
    setLoading(true)
    setError('')
    setSelected(null)
    try {
      const response = await fetch(`${API_URL}/${game.id}/lances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origemLinha: from[0],
          origemColuna: from[1],
          destinoLinha: row,
          destinoColuna: col,
        }),
      })
      const updatedGame = await readGame(response)
      setGame(updatedGame)
      setMoves((current) => [...current, describeMove({ from, to: [row, col], captured })])
      if (isAiGame && updatedGame.status !== 'XEQUE_MATE' && updatedGame.status !== 'EMPATE' && updatedGame.turnoAtual === 'PRETA') {
        await playAiMove(updatedGame)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível realizar o movimento.')
    } finally {
      setLoading(false)
    }
  }

  const gameOver = game?.status === 'XEQUE_MATE' || game?.status === 'EMPATE'
  const aiTurnPending = !!game && !gameOver && isAiGame && game.turnoAtual === 'PRETA'
  const blocked = loading || gameOver || aiTurnPending
  const turn = game?.turnoAtual === 'PRETA' ? 'Pretas' : 'Brancas'
  const status = loading
    ? (aiThinking ? 'O Minimax está pensando…' : 'Atualizando partida…')
    : game?.status === 'XEQUE_MATE'
      ? game.vencedor ? `Xeque-mate. ${game.vencedor === 'PRETA' ? 'Pretas' : 'Brancas'} vencem.` : 'Xeque-mate'
      : game?.status === 'EMPATE'
        ? 'Empate'
        : game?.status === 'XEQUE'
          ? `${turn} em xeque`
          : game ? `Vez das ${turn.toLowerCase()}` : 'Partida indisponível'

  const focusSquare = (event: KeyboardEvent<HTMLButtonElement>, row: number, col: number) => {
    let next = row * 8 + col
    switch (event.key) {
      case 'ArrowUp': next = Math.max(0, row - 1) * 8 + col; break
      case 'ArrowDown': next = Math.min(7, row + 1) * 8 + col; break
      case 'ArrowLeft': next = row * 8 + Math.max(0, col - 1); break
      case 'ArrowRight': next = row * 8 + Math.min(7, col + 1); break
      case 'Home': next = row * 8; break
      case 'End': next = row * 8 + 7; break
      default: return
    }
    event.preventDefault()
    squares.current[next]?.focus()
  }

  return (
    <main id="conteudo" tabIndex={-1} className="page game-page">
      <Link className="back-link" to={isAiGame ? '/difficulty' : '/'}>
        ← {isAiGame ? 'Escolher nível' : 'Modos de jogo'}
      </Link>
      <div className="game-heading">
        <div>
          <p className="eyebrow">{isAiGame ? 'Nível básico' : 'Dois jogadores'}</p>
          <h1>{isAiGame ? 'Contra a máquina' : 'Partida local'}</h1>
        </div>
        <button className="button-secondary" onClick={() => void createGame()} disabled={loading}>
          Nova partida
        </button>
      </div>

      <div className="game-layout">
        <section className="play-area" aria-label="Partida de xadrez">
          <p className="turn-status" role="status">
            <span className={`turn-dot ${game?.turnoAtual === 'PRETA' ? 'turn-black' : ''}`} aria-hidden="true" />
            {status}
          </p>

          <div className="board-frame">
            <div className="board-wrap">
              <div className="rank-labels" aria-hidden="true">
                {rows.map(rank => <span key={rank}>{rank}</span>)}
              </div>
              <div className="board" role="group" aria-label="Tabuleiro de xadrez">
                {game?.tabuleiro.flatMap((boardRow, row) => boardRow.map((piece, col) => {
                  const index = row * 8 + col
                  const isSelected = selected?.[0] === row && selected?.[1] === col
                  return (
                    <button
                      key={index}
                      ref={element => { squares.current[index] = element }}
                      className={`square ${(row + col) % 2 ? 'dark' : 'light'}`}
                      onClick={() => void play(row, col)}
                      onFocus={() => setFocused(index)}
                      onKeyDown={event => focusSquare(event, row, col)}
                      tabIndex={focused === index ? 0 : -1}
                      aria-pressed={isSelected}
                      aria-disabled={blocked}
                      aria-label={squareLabel(row, col, piece)}
                    >
                      {piece && (
                        <span className={`piece ${piece.cor === 'BRANCA' ? 'white-piece' : 'black-piece'}`} aria-hidden="true">
                          {symbols[piece.tipo]}
                        </span>
                      )}
                    </button>
                  )
                })) ?? Array.from({ length: 64 }, (_, index) => (
                  <span key={index} className={`square ${(Math.floor(index / 8) + index % 8) % 2 ? 'dark' : 'light'}`} />
                ))}
              </div>
            </div>
            <div className="file-labels" aria-hidden="true">{files.map(file => <span key={file}>{file}</span>)}</div>
          </div>

          {error && <p className="error-message" role="alert">{error}</p>}
          {aiTurnPending && !loading && (
            <button className="button-secondary game-retry" onClick={() => void playAiMove(game)}>
              Tentar resposta da máquina
            </button>
          )}
        </section>

        <aside className="game-details" aria-label="Detalhes da partida">
          <section>
            <div className="detail-heading"><h2>Lances</h2><span>{moves.length}</span></div>
            {moves.length > 0
              ? <ol className="move-list">{moves.map((move, index) => <li key={index}>{move}</li>)}</ol>
              : <p className="muted">Os lances aparecem aqui conforme a partida avança.</p>}
          </section>
          <section>
            <h2>Como jogar</h2>
            <p className="muted">
              {isAiGame
                ? 'Jogue com as brancas. O Minimax responde com as pretas.'
                : 'Selecione uma peça da cor da vez e depois a casa de destino.'}
            </p>
            <p className="muted keyboard-help">No teclado, use as setas para navegar e Enter para selecionar.</p>
          </section>
        </aside>
      </div>
    </main>
  )
}

export default GamePage
