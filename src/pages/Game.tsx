import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import AiIcon from '../components/AiIcon'
import { gameApi, readAiDifficulty, useGameCapabilities } from '../gameCapabilities'
import { clockDuration, formatClock, readClockSetting } from '../moveClock'
import { savedMoveText, type SavedGame } from '../savedGame'

type Color = 'BRANCA' | 'PRETA'
type PieceType = 'PEAO' | 'TORRE' | 'CAVALO' | 'BISPO' | 'RAINHA' | 'REI'
type GameStatus = 'EM_ANDAMENTO' | 'XEQUE' | 'XEQUE_MATE' | 'EMPATE' | 'TEMPO_ESGOTADO' | 'DESISTENCIA'
type Piece = { tipo: PieceType; cor: Color }
type Board = (Piece | null)[][]
type Game = SavedGame & { tabuleiro: Board; turnoAtual: Color; status: GameStatus }
type Square = [number, number]
type Promotion = 'RAINHA' | 'TORRE' | 'BISPO' | 'CAVALO'
type Move = { from: Square; to: Square }
type MatchTime = Record<Color, number>
type MatchEnd = { reason: 'Desistência' | 'Tempo esgotado'; loser: Color }
type TurnClock = { deadline: number; color: Color }

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const symbols: Record<PieceType, string> = {
  REI: '♚', RAINHA: '♛', TORRE: '♜', BISPO: '♝', CAVALO: '♞', PEAO: '♟',
}
const pieceNames: Record<PieceType, string> = {
  REI: 'rei', RAINHA: 'rainha', TORRE: 'torre', BISPO: 'bispo', CAVALO: 'cavalo', PEAO: 'peão',
}
const rows = [8, 7, 6, 5, 4, 3, 2, 1]
const colorLabels: Record<Color, string> = { BRANCA: 'Brancas', PRETA: 'Pretas' }
const promotions: Record<Promotion, string> = { RAINHA: 'Dama', TORRE: 'Torre', BISPO: 'Bispo', CAVALO: 'Cavalo' }
const promotionNotation: Record<Promotion, string> = { RAINHA: 'D', TORRE: 'T', BISPO: 'B', CAVALO: 'C' }

function displaySeconds(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000))
}

function isPromotion(piece: PieceType | undefined): piece is Promotion {
  return piece !== undefined && Object.hasOwn(promotions, piece)
}

function isFinished(game: Game) {
  return game.status !== 'EM_ANDAMENTO' && game.status !== 'XEQUE'
}

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
      : 'Não foi possível atualizar a partida'
    throw new Error(message.trimEnd().replace(/[.!?…]+$/, ''))
  }
  if (
    typeof data !== 'object' || data === null ||
    !('id' in data) || typeof data.id !== 'string' ||
    !('tabuleiro' in data) || !Array.isArray(data.tabuleiro) ||
    !('turnoAtual' in data) || (data.turnoAtual !== 'BRANCA' && data.turnoAtual !== 'PRETA') ||
    !('status' in data) || !['EM_ANDAMENTO', 'XEQUE', 'XEQUE_MATE', 'EMPATE', 'TEMPO_ESGOTADO', 'DESISTENCIA'].includes(String(data.status))
  ) {
    throw new Error('O servidor retornou um estado de partida inválido')
  }
  return data as Game
}

function describeMove(before: Board, after: Board, { from, to }: Move) {
  const [fromRow, fromCol] = from
  const [toRow, toCol] = to
  const piece = before[fromRow][fromCol]
  if (piece?.tipo === 'REI' && fromRow === toRow && Math.abs(fromCol - toCol) === 2) {
    return toCol > fromCol ? 'O-O' : 'O-O-O'
  }

  const promoted = after[toRow][toCol]?.tipo
  const promotion = piece?.tipo === 'PEAO' && isPromotion(promoted) ? `=${promotionNotation[promoted]}` : ''
  const enPassant = piece?.tipo === 'PEAO' && fromCol !== toCol && before[toRow][toCol] === null
  const capture = before[toRow][toCol] !== null || enPassant ? ' ×' : ''
  return `${files[fromCol]}${8 - fromRow} → ${files[toCol]}${8 - toRow}${capture}${promotion}`
}

function findMove(before: Board, after: Board, color: Color): Move | null {
  const origins: Square[] = []
  const destinations: Square[] = []

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

  // No roque, rei e torre mudam de casa no mesmo lance
  const king = origins.find(([row, col]) => before[row][col]?.tipo === 'REI')
  const kingDestination = destinations.find(([row, col]) => after[row][col]?.tipo === 'REI')
  if (king && kingDestination) return { from: king, to: kingDestination }

  const from = origins[0]
  const to = destinations[0]
  return from && to ? { from, to } : null
}

function Match() {
  const [searchParams] = useSearchParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const resumeId = searchParams.get('resume')
  const isAiGame = searchParams.get('mode') === 'ai'
  const clockSetting = readClockSetting(searchParams.get('time'))
  const duration = clockDuration(clockSetting)
  const matchClock = clockSetting === 'match'
  const difficulty = readAiDifficulty(searchParams.get('difficulty'))
  const capabilities = useGameCapabilities()
  const levelAvailable = !isAiGame || difficulty.id === 'EASY' || capabilities?.niveisIa.includes(difficulty.id) === true
  const names = (state as { players?: Partial<Record<Color, string>> } | null)?.players
  const whiteName = isAiGame ? '' : names?.BRANCA ?? ''
  const blackName = isAiGame ? '' : names?.PRETA ?? ''
  const [game, setGame] = useState<Game | null>(null)
  const players = {
    BRANCA: game?.configuracao?.brancas || whiteName,
    PRETA: game?.configuracao?.pretas || blackName,
  }
  const [selected, setSelected] = useState<Square | null>(null)
  const [suggestions, setSuggestions] = useState<{ forSquare: Square; destinations: Square[] } | null>(null)
  const [promotion, setPromotion] = useState<Move | null>(null)
  const promotionDialog = useRef<HTMLDialogElement>(null)
  const [focused, setFocused] = useState(52)
  const squares = useRef<(HTMLButtonElement | null)[]>([])
  const [moves, setMoves] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [matchEnd, setMatchEnd] = useState<MatchEnd | null>(null)
  const [resigning, setResigning] = useState<Color | null>(null)
  const resignationDialog = useRef<HTMLDialogElement>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const clock = useRef<TurnClock | null>(null)
  const matchTime = useRef<MatchTime>({ BRANCA: duration, PRETA: duration })
  const [matchSeconds, setMatchSeconds] = useState<MatchTime | null>(null)
  const requests = useRef<AbortController | null>(null)

  const beginTurn = useCallback((nextGame: Game) => {
    const now = Date.now()
    const previous = clock.current
    if (matchClock && previous) {
      matchTime.current[previous.color] = Math.max(0, previous.deadline - now)
    }
    const color = nextGame.turnoAtual
    if (matchClock && nextGame.brancasMs != null && nextGame.pretasMs != null) {
      matchTime.current = { BRANCA: nextGame.brancasMs, PRETA: nextGame.pretasMs }
    }
    const serverBudget = color === 'BRANCA' ? nextGame.brancasMs : nextGame.pretasMs
    const budget = serverBudget ?? (matchClock ? matchTime.current[color] : duration)
    const timed = duration > 0 && !isFinished(nextGame)
    clock.current = timed ? { deadline: now + budget, color } : null
    setMatchSeconds(matchClock ? {
      BRANCA: displaySeconds(matchTime.current.BRANCA),
      PRETA: displaySeconds(matchTime.current.PRETA),
    } : null)
    setSecondsLeft(timed && !matchClock ? displaySeconds(budget) : null)
    setGame(nextGame)
  }, [duration, matchClock])

  const finishMatch = useCallback((end: MatchEnd) => {
    requests.current?.abort()
    const active = clock.current
    if (matchClock && active) {
      matchTime.current[active.color] = Math.max(0, active.deadline - Date.now())
      setMatchSeconds({
        BRANCA: displaySeconds(matchTime.current.BRANCA),
        PRETA: displaySeconds(matchTime.current.PRETA),
      })
    }
    clock.current = null
    setSecondsLeft(matchClock || end.reason !== 'Tempo esgotado' ? null : 0)
    setMatchEnd(end)
    resignationDialog.current?.close()
    promotionDialog.current?.close()
    setResigning(null)
    setPromotion(null)
    setSelected(null)
    setError('')
    setLoading(false)
    setAiThinking(false)
  }, [matchClock])

  const expireTurn = useCallback(() => {
    const turnClock = clock.current
    if (!turnClock || Date.now() < turnClock.deadline) return false

    finishMatch({ reason: 'Tempo esgotado', loser: turnClock.color })
    if (game?.configuracao) {
      // A consulta encerra o jogo também no servidor quando o relógio realmente zera
      void fetch(`${gameApi}/${game.id}`).catch(() => {})
    }
    return true
  }, [finishMatch, game])

  useEffect(() => {
    if (!duration) return
    const interval = window.setInterval(() => {
      const active = clock.current
      if (!active || expireTurn()) return
      const remaining = Math.max(1, displaySeconds(active.deadline - Date.now()))
      if (matchClock) {
        setMatchSeconds(previous => previous && previous[active.color] !== remaining
          ? { ...previous, [active.color]: remaining }
          : previous)
      } else {
        setSecondsLeft(remaining)
      }
    }, 200)
    return () => window.clearInterval(interval)
  }, [duration, expireTurn, matchClock])

  const createGame = useCallback(async (restore?: string) => {
    requests.current?.abort()
    const controller = new AbortController()
    requests.current = controller
    const { signal } = controller
    clock.current = null
    matchTime.current = { BRANCA: duration, PRETA: duration }
    setSecondsLeft(null)
    setMatchSeconds(null)
    setMatchEnd(null)
    setPromotion(null)
    setResigning(null)
    setLoading(true)
    setAiThinking(false)
    setError('')
    setSelected(null)
    setFocused(52)
    setMoves([])
    setGame(null)
    try {
      const response = restore
        ? await fetch(`${gameApi}/${encodeURIComponent(restore)}`, { signal })
        : await fetch(gameApi, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modo: isAiGame ? 'ai' : 'local',
            ...(isAiGame ? { dificuldade: difficulty.id } : {}),
            tempo: clockSetting,
            brancas: whiteName,
            pretas: blackName,
          }),
        })
      const nextGame = await readGame(response)
      if (!signal.aborted) {
        setMoves(nextGame.lances?.map(savedMoveText) ?? [])
        beginTurn(nextGame)
      }
    } catch (requestError) {
      if (!signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Servidor indisponível')
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [beginTurn, blackName, clockSetting, difficulty.id, duration, isAiGame, whiteName])

  useEffect(() => {
    if (!levelAvailable) return
    const start = window.setTimeout(() => void createGame(resumeId ?? undefined), 0)
    return () => {
      window.clearTimeout(start)
      requests.current?.abort()
    }
  }, [createGame, levelAvailable, resumeId])

  const gameId = game?.id
  const showSuggestions = capabilities?.sugestoesDeLances === true
  useEffect(() => {
    if (!gameId || !selected || !showSuggestions) return
    const controller = new AbortController()
    const [row, col] = selected
    void fetch(`${gameApi}/${gameId}/movimentos?linha=${row}&coluna=${col}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) return
        const data = await response.json() as unknown
        if (!Array.isArray(data) || controller.signal.aborted) return
        const destinations: Square[] = []
        for (const item of data) {
          if (item && Number.isInteger(item.linha) && Number.isInteger(item.coluna)) {
            destinations.push([item.linha, item.coluna])
          }
        }
        setSuggestions({ forSquare: selected, destinations })
      })
      .catch(() => {
        // As sugestões são opcionais e o servidor ainda valida o lance
      })
    return () => controller.abort()
  }, [gameId, selected, showSuggestions])

  const playAiMove = async (currentGame: Game) => {
    const signal = requests.current?.signal
    if (!signal || signal.aborted || expireTurn()) return

    setLoading(true)
    setAiThinking(true)
    setError('')
    try {
      const response = await fetch(`${gameApi}/${currentGame.id}/ia?difficulty=${difficulty.id}`, { method: 'POST', signal })
      const updatedGame = await readGame(response)
      if (signal.aborted || expireTurn()) return

      const aiMove = findMove(currentGame.tabuleiro, updatedGame.tabuleiro, 'PRETA')
      beginTurn(updatedGame)
      if (aiMove) setMoves((current) => [...current, describeMove(currentGame.tabuleiro, updatedGame.tabuleiro, aiMove)])
    } catch (requestError) {
      if (!signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Não foi possível obter o lance da IA')
    } finally {
      if (!signal.aborted) {
        setAiThinking(false)
        setLoading(false)
      }
    }
  }

  const submitMove = async (from: Square, to: Square, promoted?: Promotion) => {
    const signal = requests.current?.signal
    if (!game || loading || !signal || signal.aborted || expireTurn()) return
    const [row, col] = to
    setLoading(true)
    setError('')
    setSelected(null)
    try {
      const response = await fetch(`${gameApi}/${game.id}/lances`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origemLinha: from[0],
          origemColuna: from[1],
          destinoLinha: row,
          destinoColuna: col,
          ...(promoted ? { promocao: promoted } : {}),
        }),
      })
      const updatedGame = await readGame(response)
      if (signal.aborted || expireTurn()) return

      beginTurn(updatedGame)
      setMoves((current) => [...current, describeMove(game.tabuleiro, updatedGame.tabuleiro, { from, to })])
      if (isAiGame && !isFinished(updatedGame) && updatedGame.turnoAtual === 'PRETA') {
        await playAiMove(updatedGame)
      }
    } catch (requestError) {
      if (!signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Não foi possível realizar o movimento')
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }

  const gameOver = matchEnd !== null || (game !== null && isFinished(game))
  const aiTurnPending = !!game && !gameOver && isAiGame && game.turnoAtual === 'PRETA'
  const blocked = loading || gameOver || aiTurnPending || resigning !== null || promotion !== null
  const turn = game?.turnoAtual ?? 'BRANCA'
  const playerLabel = (color: Color) => players[color] ? `${players[color]} · ${colorLabels[color]}` : colorLabels[color]
  const resigningPlayer = resigning && players[resigning]
  const winText = (color: Color) => {
    const name = players[color] || (isAiGame && color === 'PRETA' ? 'A IA' : '')
    return name ? `${name} vence` : `${colorLabels[color]} vencem`
  }

  let status = 'Partida indisponível'
  if (!levelAvailable) {
    status = capabilities ? 'Nível indisponível' : 'Consultando níveis da IA'
  } else if (matchEnd) {
    const winner = matchEnd.loser === 'BRANCA' ? 'PRETA' : 'BRANCA'
    status = `${matchEnd.reason} · ${winText(winner)}`
  } else if (loading) {
    status = aiThinking ? 'A IA está pensando' : 'Atualizando partida'
  } else if (game?.status === 'XEQUE_MATE') {
    status = game.vencedor ? `Xeque-mate · ${winText(game.vencedor)}` : 'Xeque-mate'
  } else if (game?.status === 'EMPATE') {
    status = 'Empate'
  } else if (game?.status === 'TEMPO_ESGOTADO' || game?.status === 'DESISTENCIA') {
    const reason = game.status === 'TEMPO_ESGOTADO' ? 'Tempo esgotado' : 'Desistência'
    status = game.vencedor ? `${reason} · ${winText(game.vencedor)}` : reason
  } else if (game?.status === 'XEQUE') {
    status = `${playerLabel(turn)} em xeque`
  } else if (game) {
    status = players[turn] ? `Vez de ${playerLabel(turn)}` : `Vez das ${colorLabels[turn].toLowerCase()}`
  }

  function restart() {
    if (!resumeId) {
      void createGame()
      return
    }
    const params = new URLSearchParams(searchParams)
    params.delete('resume')
    void navigate(`/game?${params}`, { replace: true, state: { players } })
  }

  async function resign() {
    if (!game || !resigning || expireTurn()) return
    if (!game.configuracao) {
      finishMatch({ reason: 'Desistência', loser: resigning })
      return
    }
    const signal = requests.current?.signal
    if (!signal || signal.aborted) return
    try {
      setError('')
      const response = await fetch(`${gameApi}/${game.id}/desistencia?cor=${resigning}`, { method: 'POST', signal })
      const finished = await readGame(response)
      if (signal.aborted) return
      beginTurn(finished)
      resignationDialog.current?.close()
      setResigning(null)
      setSelected(null)
    } catch (requestError) {
      if (!signal.aborted) {
        resignationDialog.current?.close()
        setError(requestError instanceof Error ? requestError.message : 'Não foi possível encerrar a partida')
      }
    }
  }

  function play(row: number, col: number) {
    if (!game || blocked || expireTurn()) return
    const piece = game.tabuleiro[row][col]
    if (!selected || piece?.cor === game.turnoAtual) {
      if (piece?.cor !== game.turnoAtual) {
        setError(`Selecione uma peça ${turn === 'BRANCA' ? 'branca' : 'preta'} para jogar`)
        return
      }
      setError('')
      setSelected(selected?.[0] === row && selected[1] === col ? null : [row, col])
      return
    }

    const [fromRow, fromCol] = selected
    const to: Square = [row, col]
    if (game.tabuleiro[fromRow][fromCol]?.tipo === 'PEAO' && row === (turn === 'BRANCA' ? 0 : 7)) {
      setPromotion({ from: selected, to })
      setSelected(null)
      promotionDialog.current?.showModal()
      return
    }
    void submitMove(selected, to)
  }

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
      <Link className="back-link" to={isAiGame ? '/difficulty' : '/local'}>
        ← {isAiGame ? 'Escolher nível' : 'Configurar partida'}
      </Link>
      <div className="game-heading">
        <div>
          <p className="eyebrow">{isAiGame ? `Nível ${difficulty.label.toLowerCase()}` : 'Dois jogadores'}</p>
          <h1 className={isAiGame ? 'ai-heading' : undefined}>
            {isAiGame ? <><AiIcon />Partida contra a IA</> : 'Partida local'}
          </h1>
        </div>
        <div className="game-header-actions" role="group" aria-label="Ações da partida">
          <button className="button-secondary" onClick={restart} disabled={loading || !levelAvailable}>
            Nova partida
          </button>
          <button
            className="button-secondary button-danger"
            aria-haspopup="dialog"
            disabled={!game || gameOver}
            onClick={() => {
              if (expireTurn()) return
              setResigning(isAiGame ? 'BRANCA' : turn)
              resignationDialog.current?.showModal()
            }}
          >
            Desistir da partida
          </button>
        </div>
      </div>

      <div className="game-layout">
        <section className="play-area" aria-label="Partida de xadrez">
          <div className="turn-bar">
            <p className="turn-status" role="status">
              {!gameOver && <span className={`turn-dot ${turn === 'PRETA' ? 'turn-black' : ''}`} aria-hidden="true" />}
              {status}
            </p>
            {matchSeconds && (
              <div className="match-clocks" aria-label="Tempo por jogador">
                {(Object.keys(colorLabels) as Color[]).map(color => (
                  <span
                    key={color}
                    className={`move-clock match-clock ${!gameOver && turn === color ? 'clock-active' : ''} ${matchSeconds[color] <= 10 ? 'clock-warning' : ''}`}
                    role="timer"
                    aria-label={`Tempo das ${colorLabels[color].toLowerCase()}`}
                  >
                    {colorLabels[color]} <strong>{formatClock(matchSeconds[color])}</strong>
                  </span>
                ))}
              </div>
            )}
            {secondsLeft !== null && (
              <span className={`move-clock ${secondsLeft <= 5 ? 'clock-warning' : ''}`} role="timer" aria-label="Tempo restante da jogada">
                {secondsLeft} s
              </span>
            )}
          </div>

          <div className="board-frame">
            <div className="board-wrap">
              <div className="rank-labels" aria-hidden="true">
                {rows.map(rank => <span key={rank}>{rank}</span>)}
              </div>
              <div className="board" role="group" aria-label="Tabuleiro de xadrez">
                {game?.tabuleiro.flatMap((boardRow, row) => boardRow.map((piece, col) => {
                  const index = row * 8 + col
                  const isSelected = selected?.[0] === row && selected?.[1] === col
                  const suggested = !blocked && selected && suggestions?.forSquare === selected &&
                    suggestions.destinations.some(([targetRow, targetCol]) => row === targetRow && col === targetCol)
                  return (
                    <button
                      key={index}
                      ref={element => { squares.current[index] = element }}
                      className={`square ${(row + col) % 2 ? 'dark' : 'light'}${suggested ? ' square-suggested' : ''}`}
                      onClick={() => play(row, col)}
                      onFocus={() => setFocused(index)}
                      onKeyDown={event => focusSquare(event, row, col)}
                      tabIndex={focused === index ? 0 : -1}
                      aria-pressed={isSelected}
                      aria-disabled={blocked}
                      aria-label={`${squareLabel(row, col, piece)}${suggested ? ', lance possível' : ''}`}
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
          {aiTurnPending && !loading && !resigning && (
            <button className="button-secondary game-retry" onClick={() => void playAiMove(game)}>
              Tentar resposta da IA
            </button>
          )}
        </section>

        <aside className="game-details" aria-label="Detalhes da partida">
          <section>
            <div className="detail-heading"><h2>Lances</h2><span>{moves.length}</span></div>
            {moves.length > 0
              ? <ol className="move-list">{moves.map((move, index) => <li key={index}>{move}</li>)}</ol>
              : <p className="muted">Nenhum lance ainda</p>}
          </section>
        </aside>
      </div>

      <dialog
        ref={promotionDialog}
        className="game-dialog"
        aria-labelledby="promotion-title"
        onClose={() => setPromotion(null)}
      >
        <h2 id="promotion-title">Promover peão</h2>
        <div className="action-buttons promotion-actions">
          {(Object.keys(promotions) as Promotion[]).map(piece => (
            <button key={piece} className="button-secondary" onClick={() => {
              if (!promotion) return
              promotionDialog.current?.close()
              void submitMove(promotion.from, promotion.to, piece)
            }}>
              <span className="promotion-symbol" aria-hidden="true">{symbols[piece]}</span>
              {promotions[piece]}
            </button>
          ))}
        </div>
        <button className="button-secondary promotion-cancel" onClick={() => promotionDialog.current?.close()}>Cancelar</button>
      </dialog>

      <dialog
        ref={resignationDialog}
        className="game-dialog"
        aria-labelledby="resignation-title"
        aria-describedby="resignation-player"
        onClose={() => setResigning(null)}
      >
        <h2 id="resignation-title">Confirmar desistência</h2>
        <p id="resignation-player" className="muted">
          {resigning && (
            <>
              Quem desiste: {resigningPlayer && `${resigningPlayer} (`}
              <strong>{colorLabels[resigning]}</strong>
              {resigningPlayer && ')'}
            </>
          )}
        </p>
        <div className="action-buttons">
          <button className="button-secondary" onClick={() => resignationDialog.current?.close()}>
            Continuar jogando
          </button>
          <button className="button-secondary button-danger" onClick={() => void resign()}>
            Desistir
          </button>
        </div>
      </dialog>
    </main>
  )
}

export default function GamePage() {
  const { key } = useLocation()
  return <Match key={key} />
}
