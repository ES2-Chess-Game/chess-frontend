import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header'

type Color = 'BRANCA' | 'PRETA'
type PieceType = 'PEAO' | 'TORRE' | 'CAVALO' | 'BISPO' | 'RAINHA' | 'REI'
type GameStatus = 'EM_ANDAMENTO' | 'XEQUE' | 'XEQUE_MATE' | 'EMPATE'
type Piece = { tipo: PieceType; cor: Color }
type Board = (Piece | null)[][]
type Game = { id: string; tabuleiro: Board; turnoAtual: Color; status: GameStatus }
type Move = { from: [number, number]; to: [number, number]; captured: boolean }

const API_URL = 'http://localhost:8080/api/partidas'
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const symbols: Record<Color, Record<PieceType, string>> = {
  BRANCA: { REI: '♔', RAINHA: '♕', TORRE: '♖', BISPO: '♗', CAVALO: '♘', PEAO: '♙' },
  PRETA: { REI: '♚', RAINHA: '♛', TORRE: '♜', BISPO: '♝', CAVALO: '♞', PEAO: '♟' },
}

async function readGame(response: Response): Promise<Game> {
  const data: unknown = await response.json()
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
  const [moves, setMoves] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const mounted = useRef(false)

  const createGame = async () => {
    setLoading(true)
    setError('')
    setSelected(null)
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

  const aiTurnPending = isAiGame && game?.status !== 'XEQUE_MATE' && game?.status !== 'EMPATE' && game?.turnoAtual === 'PRETA'
  const gameOver = game?.status === 'XEQUE_MATE' || game?.status === 'EMPATE'

  return (
    <main className="app-shell">
      <Header />
      <div className="content-grid">
        <section className="play-area">
          <div className="eyebrow">{isAiGame ? 'JOGADOR VS MÁQUINA · NÍVEL 1' : 'PARTIDA CASUAL'}</div>
          <div className="match-heading">
            <div>
              <h1>{isAiGame ? 'Duelo contra a IA' : 'Duelo no tabuleiro'}</h1>
              <p>{isAiGame ? 'Você joga com as brancas; a IA responde com as pretas.' : 'Concentre-se no próximo movimento.'}</p>
            </div>
            <button className="new-game" onClick={() => void createGame()} disabled={loading}>↻ <span>Nova partida</span></button>
          </div>
          <div className="board-frame">
            <div className="player-row">
              <div className="avatar black-avatar">♟</div>
              <div><strong>{isAiGame ? 'Minimax' : 'Jogador 2'}</strong><span>{isAiGame ? 'Inteligência artificial' : 'Jogador local'}</span></div>
              <div className="clock"><small>PRETAS</small><b>10:00</b></div>
            </div>
            <div className="board-wrap">
              <div className="rank-labels">{[8, 7, 6, 5, 4, 3, 2, 1].map((rank) => <span key={rank}>{rank}</span>)}</div>
              <div className="board">
                {game?.tabuleiro.map((boardRow, rowIndex) => boardRow.map((boardPiece, colIndex) => {
                  const isSelected = selected?.[0] === rowIndex && selected?.[1] === colIndex
                  return (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      className={`square ${(rowIndex + colIndex) % 2 ? 'dark' : 'light'} ${isSelected ? 'selected' : ''}`}
                      onClick={() => void play(rowIndex, colIndex)}
                      disabled={loading || !game || gameOver || (isAiGame && game.turnoAtual !== 'BRANCA')}
                      aria-label={`${files[colIndex]}${8 - rowIndex}`}
                    >
                      {boardPiece && <span className={`piece ${boardPiece.cor === 'BRANCA' ? 'white-piece' : 'black-piece'}`}>{symbols[boardPiece.cor][boardPiece.tipo]}</span>}
                    </button>
                  )
                })) ?? Array.from({ length: 64 }, (_, index) => <span key={index} className="square" />)}
              </div>
            </div>
            <div className="file-labels">{files.map((file) => <span key={file}>{file}</span>)}</div>
            <div className="player-row bottom-player">
              <div className="avatar white-avatar">♙</div>
              <div><strong>Você</strong><span>{isAiGame ? 'Jogador' : 'Jogador 1'}</span></div>
              <div className="clock active-clock"><small>BRANCAS</small><b>10:00</b></div>
            </div>
          </div>
          {aiTurnPending && !loading && (
            <button className="new-game retry-ai" onClick={() => void playAiMove(game!)}>Tentar resposta da IA</button>
          )}
          {loading && <p className="game-feedback" role="status">{aiThinking ? 'A IA está pensando…' : 'Atualizando partida…'}</p>}
          {gameOver && <p className="game-feedback" role="status">{game?.status === 'XEQUE_MATE' ? 'Xeque-mate.' : 'Empate.'}</p>}
          {error && <div className="error-message" role="alert">! {error}</div>}
        </section>
        <aside className="side-panel">
          <div className="turn-card">
            <div className={`turn-indicator ${game?.turnoAtual === 'PRETA' ? 'turn-black' : ''}`} />
            <div><span>VEZ DE JOGAR</span><strong>{game?.turnoAtual === 'PRETA' ? (isAiGame ? 'Minimax' : 'Pretas') : 'Brancas'}</strong></div>
            <div className="status-pill">{game?.status === 'EM_ANDAMENTO' ? 'Ao vivo' : game?.status ?? 'Carregando'}</div>
          </div>
          <div className="panel-section">
            <div className="section-heading"><h2>Movimentos</h2><span>{moves.length}</span></div>
            {moves.length
              ? <div className="move-list">{moves.map((move, index) => <div key={`${move}-${index}`}><small>{String(index + 1).padStart(2, '0')}</small><span>{move}</span></div>)}</div>
              : <div className="empty-state"><span>♜</span><p>A partida começa quando<br />você fizer o primeiro lance.</p></div>}
          </div>
          <div className="panel-section info-section">
            <h2>Como jogar</h2>
            <p>{isAiGame ? 'Faça seu lance com as brancas. O Minimax responderá automaticamente.' : 'Selecione uma peça da cor da vez e depois escolha a casa de destino.'}</p>
            <div className="legend"><span><i className="legend-square light" /> sua vez</span><span><i className="legend-square dark" /> tabuleiro</span></div>
          </div>
        </aside>
      </div>
    </main>
  )
}

export default GamePage
