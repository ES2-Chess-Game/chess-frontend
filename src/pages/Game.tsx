import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header'

type Color = 'BRANCA' | 'PRETA'
type PieceType = 'PEAO' | 'TORRE' | 'CAVALO' | 'BISPO' | 'RAINHA' | 'REI'
type GameStatus = 'EM_ANDAMENTO' | 'XEQUE' | 'XEQUE_MATE' | 'EMPATE'
type AiDifficulty = 'EASY' | 'MEDIUM' | 'ADVANCED'
type Piece = { tipo: PieceType; cor: Color }
type Board = (Piece | null)[][]
type Game = { id: string; tabuleiro: Board; turnoAtual: Color; status: GameStatus }
type PromotionType = 'RAINHA' | 'TORRE' | 'BISPO' | 'CAVALO'
type PendingPromotion = { from: [number, number]; to: [number, number] }
type Move = { from: [number, number]; to: [number, number]; captured: boolean; promotion?: PromotionType }

const API_URL = 'http://localhost:8080/api/partidas'
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const difficultyLabels: Record<AiDifficulty, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Médio',
  ADVANCED: 'Avançado',
}
const promotionPieces: PromotionType[] = ['RAINHA', 'TORRE', 'BISPO', 'CAVALO']
const promotionLabels: Record<PromotionType, string> = {
  RAINHA: 'Rainha',
  TORRE: 'Torre',
  BISPO: 'Bispo',
  CAVALO: 'Cavalo',
}
const promotionNotation: Record<PromotionType, string> = {
  RAINHA: 'Q',
  TORRE: 'R',
  BISPO: 'B',
  CAVALO: 'N',
}
function isPromotionType(piece: PieceType | undefined): piece is PromotionType {
  return piece === 'RAINHA' || piece === 'TORRE' || piece === 'BISPO' || piece === 'CAVALO'
}
function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
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
  if (fromRow === toRow && fromCol === 4 && toCol === 6) return 'O-O'
  if (fromRow === toRow && fromCol === 4 && toCol === 2) return 'O-O-O'
  const promotion = isPromotionType(move.promotion)
    ? `=${promotionNotation[move.promotion]}`
    : ''
  return `${files[fromCol]}${8 - fromRow} → ${files[toCol]}${8 - toRow}${move.captured ? ' ×' : ''}${promotion}`
}

function findMove(before: Board, after: Board, color: Color): Move | null {
  const homeRow = color === 'BRANCA' ? 7 : 0
  if (
    before[homeRow][4]?.cor === color && before[homeRow][4]?.tipo === 'REI' &&
    after[homeRow][6]?.cor === color && after[homeRow][6]?.tipo === 'REI'
  ) {
    return { from: [homeRow, 4], to: [homeRow, 6], captured: false }
  }
  if (
    before[homeRow][4]?.cor === color && before[homeRow][4]?.tipo === 'REI' &&
    after[homeRow][2]?.cor === color && after[homeRow][2]?.tipo === 'REI'
  ) {
    return { from: [homeRow, 4], to: [homeRow, 2], captured: false }
  }

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
    const to = destinations.find(([toRow, toCol]) => {
      const destinationPiece = after[toRow][toCol]
      return destinationPiece?.tipo === movedPiece?.tipo ||
        (movedPiece?.tipo === 'PEAO' && (toRow === 0 || toRow === 7))
    })
    if (!to) continue

    const [toRow, toCol] = to
    const enPassantCapture = movedPiece?.tipo === 'PEAO' &&
      fromCol !== toCol &&
      before[toRow][toCol] === null &&
      before[fromRow][toCol]?.cor !== undefined &&
      before[fromRow][toCol]?.cor !== movedPiece.cor
    const promotedPiece = movedPiece?.tipo === 'PEAO' && (toRow === 0 || toRow === 7)
      ? after[toRow][toCol]?.tipo
      : undefined
    return {
      from,
      to,
      captured: before[toRow][toCol] !== null || enPassantCapture,
      ...(isPromotionType(promotedPiece) ? { promotion: promotedPiece } : {}),
    }
  }

  return null
}

function GamePage() {
  const [searchParams] = useSearchParams()
  const isAiGame = searchParams.get('mode') === 'ai'
  const requestedDifficulty = searchParams.get('difficulty')
  const aiDifficulty: AiDifficulty = requestedDifficulty === 'EASY' ||
    requestedDifficulty === 'MEDIUM' || requestedDifficulty === 'ADVANCED'
    ? requestedDifficulty
    : 'ADVANCED'
  const [game, setGame] = useState<Game | null>(null)
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [suggestedMoves, setSuggestedMoves] = useState<[number, number][]>([])
  const [moves, setMoves] = useState<string[]>([])
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [whiteMs, setWhiteMs] = useState(600000)
  const [blackMs, setBlackMs] = useState(600000)
  const [timeExpired, setTimeExpired] = useState<Color | null>(null)
  const turnRef = useRef<Color>('BRANCA')
  const allMovesRef = useRef<Array<{ from: [number, number]; to: [number, number] }>>([])
  const mounted = useRef(false)

  const isCheckmate = game?.status === 'XEQUE_MATE'
  const isStalemate = game?.status === 'EMPATE'
  const gameOver = isCheckmate || isStalemate || timeExpired !== null

  useEffect(() => {
    if (game?.turnoAtual) {
      turnRef.current = game.turnoAtual
    }
  }, [game?.turnoAtual])

  const gameId = game?.id
  useEffect(() => {
    if (!gameId || gameOver) return

    let lastTick = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const delta = now - lastTick
      lastTick = now

      if (turnRef.current === 'BRANCA') {
        setWhiteMs((prev) => {
          const next = prev - delta
          if (next <= 0) {
            setTimeExpired('BRANCA')
            return 0
          }
          return next
        })
      } else {
        setBlackMs((prev) => {
          const next = prev - delta
          if (next <= 0) {
            setTimeExpired('PRETA')
            return 0
          }
          return next
        })
      }
    }, 100)

    return () => clearInterval(timer)
  }, [gameId, gameOver])

  const fetchAllLegalMoves = async (gameId: string) => {
    try {
      const response = await fetch(`${API_URL}/${gameId}/movimentos`)
      if (response.ok) {
        const data: unknown = await response.json()
        if (Array.isArray(data)) {
          const list: Array<{ from: [number, number]; to: [number, number] }> = []
          for (const item of data) {
            if (typeof item === 'object' && item !== null) {
              const fromRow = 'origemLinha' in item && typeof item.origemLinha === 'number'
                ? item.origemLinha
                : undefined
              const fromCol = 'origemColuna' in item && typeof item.origemColuna === 'number'
                ? item.origemColuna
                : undefined
              const toRow = 'destinoLinha' in item && typeof item.destinoLinha === 'number'
                ? item.destinoLinha
                : undefined
              const toCol = 'destinoColuna' in item && typeof item.destinoColuna === 'number'
                ? item.destinoColuna
                : undefined
              if (fromRow !== undefined && fromCol !== undefined && toRow !== undefined && toCol !== undefined) {
                list.push({ from: [fromRow, fromCol], to: [toRow, toCol] })
              }
            }
          }
          allMovesRef.current = list
        }
      }
    } catch {
      // Ignora falhas de rede secundárias
    }
  }

  const fetchSuggestedMoves = async (gameId: string, row: number, col: number) => {
    try {
      const response = await fetch(`${API_URL}/${gameId}/movimentos?linha=${row}&coluna=${col}`)
      if (response.ok) {
        const data: unknown = await response.json()
        if (Array.isArray(data)) {
          const list: [number, number][] = []
          for (const item of data) {
            if (typeof item === 'object' && item !== null) {
              const r = 'linha' in item && typeof item.linha === 'number'
                ? item.linha
                : ('row' in item && typeof item.row === 'number' ? item.row : undefined)
              const c = 'coluna' in item && typeof item.coluna === 'number'
                ? item.coluna
                : ('col' in item && typeof item.col === 'number' ? item.col : undefined)
              if (r !== undefined && c !== undefined) {
                list.push([r, c])
              }
            }
          }
          setSuggestedMoves(list)
        }
      }
    } catch {
      // Ignora falhas de rede na busca de sugestões
    }
  }

  const showMovesForPiece = (gameId: string, row: number, col: number) => {
    const fromCached = allMovesRef.current
      .filter((m) => m.from[0] === row && m.from[1] === col)
      .map((m) => m.to)
    if (fromCached.length > 0) {
      setSuggestedMoves(fromCached)
    } else {
      void fetchSuggestedMoves(gameId, row, col)
    }
  }

  const createGame = async () => {
    setLoading(true)
    setError('')
    setSelected(null)
    setSuggestedMoves([])
    setMoves([])
    setGame(null)
    setWhiteMs(600000)
    setBlackMs(600000)
    setTimeExpired(null)
    turnRef.current = 'BRANCA'
    allMovesRef.current = []
    try {
      const response = await fetch(API_URL, { method: 'POST' })
      const initialGame = await readGame(response)
      setGame(initialGame)
      void fetchAllLegalMoves(initialGame.id)
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
      // Simula tempo natural de pensamento da IA (1.3s a 2.0s) para que o relógio das pretas corra de forma realista
      const thinkDelay = new Promise((resolve) =>
        setTimeout(resolve, 1300 + Math.floor(Math.random() * 700))
      )
      const fetchPromise = fetch(
        `${API_URL}/${currentGame.id}/ia?difficulty=${aiDifficulty}`,
        { method: 'POST' },
      ).then((res) => readGame(res))

      const [, updatedGame] = await Promise.all([thinkDelay, fetchPromise])
      const aiMove = findMove(currentGame.tabuleiro, updatedGame.tabuleiro, 'PRETA')
      setGame(updatedGame)
      if (aiMove) setMoves((current) => [...current, describeMove(aiMove)])
      void fetchAllLegalMoves(updatedGame.id)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível obter o lance da IA.')
    } finally {
      setAiThinking(false)
      setLoading(false)
    }
  }

  const submitMove = async (from: [number, number], to: [number, number], promotion?: PromotionType) => {
    if (!game) return
    const piece = game.tabuleiro[from[0]][from[1]]
    const enPassantCapture = piece?.tipo === 'PEAO' &&
      from[1] !== to[1] &&
      game.tabuleiro[to[0]][to[1]] === null &&
      game.tabuleiro[from[0]][to[1]]?.cor !== undefined &&
      game.tabuleiro[from[0]][to[1]]?.cor !== piece.cor

    setLoading(true)
    setError('')
    setSelected(null)
    setSuggestedMoves([])
    setPendingPromotion(null)
    try {
      const response = await fetch(`${API_URL}/${game.id}/lances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origemLinha: from[0],
          origemColuna: from[1],
          destinoLinha: to[0],
          destinoColuna: to[1],
          ...(promotion ? { promocao: promotion } : {}),
        }),
      })
      const updatedGame = await readGame(response)
      setGame(updatedGame)
      setMoves((current) => [...current, describeMove({
        from,
        to,
        captured: game.tabuleiro[to[0]][to[1]] !== null || enPassantCapture,
        ...(promotion ? { promotion } : {}),
      })])
      void fetchAllLegalMoves(updatedGame.id)
      if (isAiGame && updatedGame.status !== 'XEQUE_MATE' && updatedGame.status !== 'EMPATE' && updatedGame.turnoAtual === 'PRETA') {
        await playAiMove(updatedGame)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível realizar o movimento.')
    } finally {
      setLoading(false)
    }
  }

  const play = async (row: number, col: number) => {
    if (!game || loading || pendingPromotion || gameOver || (isAiGame && game.turnoAtual !== 'BRANCA')) return
    const piece = game.tabuleiro[row][col]
    if (!selected) {
      if (!piece || piece.cor !== game.turnoAtual) {
        setError(`Selecione uma peça ${game.turnoAtual === 'BRANCA' ? 'branca' : 'preta'} para jogar.`)
        return
      }
      setError('')
      setSelected([row, col])
      showMovesForPiece(game.id, row, col)
      return
    }
    if (selected[0] === row && selected[1] === col) {
      setSelected(null)
      setSuggestedMoves([])
      return
    }
    if (piece && piece.cor === game.turnoAtual) {
      setError('')
      setSelected([row, col])
      showMovesForPiece(game.id, row, col)
      return
    }

    const from = selected
    const to: [number, number] = [row, col]
    const movingPiece = game.tabuleiro[from[0]][from[1]]
    setSelected(null)
    setSuggestedMoves([])
    if (movingPiece?.tipo === 'PEAO' && (row === 0 || row === 7)) {
      setPendingPromotion({
        from,
        to,
      })
      return
    }
    void submitMove(from, to)
  }

  const aiTurnPending = isAiGame && !gameOver && game?.turnoAtual === 'PRETA'

  return (
    <main className="app-shell">
      <Header />
      <div className="content-grid">
        <section className="play-area">
          <div className="eyebrow">{isAiGame ? `JOGADOR VS MÁQUINA · ${difficultyLabels[aiDifficulty].toUpperCase()}` : 'PARTIDA CASUAL'}</div>
          <div className="match-heading">
            <div>
              <h1>{isAiGame ? 'Duelo contra a IA' : 'Duelo no tabuleiro'}</h1>
              <p>{isAiGame ? 'Você joga com as brancas; a IA responde com as pretas.' : 'Concentre-se no próximo movimento.'}</p>
            </div>
            <button className="new-game" onClick={() => void createGame()} disabled={loading}>↻ <span>Nova partida</span></button>
          </div>
          {isCheckmate && (
            <div className="game-over-banner" role="alert">
              <div className="game-over-title">Fim de jogo</div>
              <div className="game-over-subtitle">
                {game?.turnoAtual === 'BRANCA'
                  ? (isAiGame ? 'Você tomou xeque-mate! Vitória do Minimax.' : 'Xeque-mate! Vitória das Pretas.')
                  : (isAiGame ? 'Xeque-mate! Você venceu a IA.' : 'Xeque-mate! Vitória das Brancas.')}
              </div>
            </div>
          )}
          {timeExpired && (
            <div className="game-over-banner" role="alert">
              <div className="game-over-title">Fim de jogo</div>
              <div className="game-over-subtitle">
                {timeExpired === 'BRANCA'
                  ? (isAiGame ? 'Seu tempo esgotou! Vitória do Minimax.' : 'Tempo esgotado! Vitória das Pretas.')
                  : (isAiGame ? 'Tempo do Minimax esgotou! Você venceu.' : 'Tempo esgotado! Vitória das Brancas.')}
              </div>
            </div>
          )}
          <div className="board-frame">
            <div className="player-row">
              <div className="avatar black-avatar">♟</div>
              <div><strong>{isAiGame ? 'Minimax' : 'Jogador 2'}</strong><span>{isAiGame ? 'Inteligência artificial' : 'Jogador local'}</span></div>
              <div className={`clock ${game?.turnoAtual === 'PRETA' && !gameOver ? 'active-clock' : ''}`}>
                <small>PRETAS</small>
                <b>{formatClock(blackMs)}</b>
              </div>
            </div>
            <div className="board-wrap">
              <div className="rank-labels">{[8, 7, 6, 5, 4, 3, 2, 1].map((rank) => <span key={rank}>{rank}</span>)}</div>
              <div className="board">
                {game?.tabuleiro.map((boardRow, rowIndex) => boardRow.map((boardPiece, colIndex) => {
                  const isSelected = selected?.[0] === rowIndex && selected?.[1] === colIndex
                  const isSuggested = suggestedMoves.some(([r, c]) => r === rowIndex && c === colIndex)
                  const isCapture = isSuggested && (
                    boardPiece !== null ||
                    (selected && game?.tabuleiro[selected[0]][selected[1]]?.tipo === 'PEAO' && selected[1] !== colIndex)
                  )
                  return (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      className={`square ${(rowIndex + colIndex) % 2 ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isSuggested ? 'suggested' : ''}`}
                      onClick={() => void play(rowIndex, colIndex)}
                      disabled={loading || !game || gameOver || Boolean(pendingPromotion) || (isAiGame && game.turnoAtual !== 'BRANCA')}
                      aria-label={`${files[colIndex]}${8 - rowIndex}${isSuggested ? ' (movimento sugerido)' : ''}`}
                    >
                      {boardPiece && <span className={`piece ${boardPiece.cor === 'BRANCA' ? 'white-piece' : 'black-piece'}`}>{symbols[boardPiece.cor][boardPiece.tipo]}</span>}
                      {isSuggested && !isCapture && <span className="chess-dot-hint" aria-hidden="true" />}
                      {isSuggested && isCapture && <span className="chess-capture-ring" aria-hidden="true" />}
                    </button>
                  )
                })) ?? Array.from({ length: 64 }, (_, index) => <span key={index} className="square" />)}
              </div>
            </div>
            <div className="file-labels">{files.map((file) => <span key={file}>{file}</span>)}</div>
            <div className="player-row bottom-player">
              <div className="avatar white-avatar">♙</div>
              <div><strong>Você</strong><span>{isAiGame ? 'Jogador' : 'Jogador 1'}</span></div>
              <div className={`clock ${game?.turnoAtual === 'BRANCA' && !gameOver ? 'active-clock' : ''}`}>
                <small>BRANCAS</small>
                <b>{formatClock(whiteMs)}</b>
              </div>
            </div>
          </div>
          {pendingPromotion && game && (
            <div className="promotion-options" role="group" aria-label="Escolha a peça da promoção">
              <span>Promover peão:</span>
              {promotionPieces.map((piece) => (
                <button
                  key={piece}
                  type="button"
                  className="new-game promotion-choice"
                  onClick={() => void submitMove(pendingPromotion.from, pendingPromotion.to, piece)}
                  disabled={loading}
                  aria-label={`Promover para ${promotionLabels[piece]}`}
                >
                  <span className={`piece ${game.turnoAtual === 'BRANCA' ? 'white-piece' : 'black-piece'}`}>
                    {symbols[game.turnoAtual][piece]}
                  </span>
                  <small>{promotionLabels[piece]}</small>
                </button>
              ))}
              <button
                type="button"
                className="new-game promotion-cancel"
                onClick={() => setPendingPromotion(null)}
                disabled={loading}
              >
                Cancelar
              </button>
            </div>
          )}
          {aiTurnPending && !loading && (
            <button className="new-game retry-ai" onClick={() => void playAiMove(game!)}>Tentar resposta da IA</button>
          )}
          {loading && <p className="game-feedback" role="status">{aiThinking ? 'A IA está pensando…' : 'Atualizando partida…'}</p>}
          {gameOver && (
            <p className="game-feedback" role="status">
              <strong>Fim de jogo: </strong>
              {isCheckmate ? 'Xeque-mate.' : isStalemate ? 'Empate.' : 'Tempo esgotado.'}
            </p>
          )}
          {game?.status === 'XEQUE' && !gameOver && <p className="game-feedback" role="status">Xeque!</p>}
          {error && <div className="error-message" role="alert">! {error}</div>}
        </section>
        <aside className="side-panel">
          <div className="turn-card">
            <div className={`turn-indicator ${game?.turnoAtual === 'PRETA' ? 'turn-black' : ''}`} />
            <div>
              <span>{gameOver ? 'PARTIDA ENCERRADA' : 'VEZ DE JOGAR'}</span>
              <strong>{gameOver ? 'Fim de jogo' : (game?.turnoAtual === 'PRETA' ? (isAiGame ? 'Minimax' : 'Pretas') : 'Brancas')}</strong>
            </div>
            <div className={`status-pill ${gameOver ? 'status-game-over' : ''}`}>
              {isCheckmate
                ? 'Fim de jogo (Xeque-mate)'
                : isStalemate
                ? 'Fim de jogo (Empate)'
                : timeExpired
                ? 'Fim de jogo (Tempo)'
                : game?.status === 'EM_ANDAMENTO'
                ? 'Ao vivo'
                : game?.status ?? 'Carregando'}
            </div>
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
