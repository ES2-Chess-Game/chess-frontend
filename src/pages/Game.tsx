import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, useBlocker, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import AiIcon from '../components/AiIcon'
import CapturedPieces from '../components/CapturedPieces'
import MoveList from '../components/MoveList'
import { gameApi, readAiDifficulty, useGameCapabilities } from '../gameCapabilities'
import { clockDuration, formatClock, readClockSetting } from '../moveClock'
import {
  historyGameUrl, isFinished, pieceLabel, pieceSymbols as symbols, type BoardPiece,
  type PieceType, type PlayerColor as Color,
  type SavedGame, type SavedMove,
} from '../savedGame'

type GameStatus = 'EM_ANDAMENTO' | 'XEQUE' | 'XEQUE_MATE' | 'EMPATE' | 'TEMPO_ESGOTADO' | 'DESISTENCIA'
type Piece = BoardPiece
type Board = (Piece | null)[][]
type Game = SavedGame & { tabuleiro: Board; turnoAtual: Color; status: GameStatus }
type Square = [number, number]
type Promotion = 'RAINHA' | 'TORRE' | 'BISPO' | 'CAVALO'
type Move = { from: Square; to: Square }
type MatchTime = Record<Color, number>
type MatchEnd = { reason: 'Desistência' | 'Tempo esgotado'; loser: Color }
type TurnClock = { deadline: number; color: Color }

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const rows = [8, 7, 6, 5, 4, 3, 2, 1]
const colorLabels: Record<Color, string> = { BRANCA: 'Brancas', PRETA: 'Pretas' }
const promotions: Record<Promotion, string> = { RAINHA: 'Dama', TORRE: 'Torre', BISPO: 'Bispo', CAVALO: 'Cavalo' }

function displaySeconds(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000))
}

function isPromotion(piece: PieceType | undefined): piece is Promotion {
  return piece !== undefined && Object.hasOwn(promotions, piece)
}

function squareLabel(row: number, col: number, piece: Piece | null) {
  return `${files[col]}${8 - row}, ${piece ? pieceLabel(piece.tipo, piece.cor) : 'vazia'}`
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

function describeMove(before: Board, after: Board, { from, to }: Move): SavedMove | undefined {
  const [row, col] = from
  const [targetRow, targetCol] = to
  const piece = before[row][col]
  if (!piece) return undefined

  const target = before[targetRow][targetCol]
  const enPassant = piece.tipo === 'PEAO' && col !== targetCol && target === null
  const captured = enPassant ? before[row][targetCol] : target
  const promoted = after[targetRow][targetCol]?.tipo

  return {
    origem: { row, col }, destino: { row: targetRow, col: targetCol }, cor: piece.cor, peca: piece.tipo,
    promocao: piece.tipo === 'PEAO' && isPromotion(promoted) ? promoted : null,
    captura: captured?.tipo ?? null,
  }
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
  const [moves, setMoves] = useState<SavedMove[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [matchEnd, setMatchEnd] = useState<MatchEnd | null>(null)
  const [resigning, setResigning] = useState<Color | null>(null)
  const resignationDialog = useRef<HTMLDialogElement>(null)
  const departureDialog = useRef<HTMLDialogElement>(null)
  const [restartRequested, setRestartRequested] = useState(false)
  const [ending, setEnding] = useState(false)
  const allowNavigation = useRef(false)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const clock = useRef<TurnClock | null>(null)
  const matchTime = useRef<MatchTime>({ BRANCA: duration, PRETA: duration })
  const [matchSeconds, setMatchSeconds] = useState<MatchTime | null>(null)
  const requests = useRef<AbortController | null>(null)

  const beginTurn = useCallback((nextGame: Game, fallback?: SavedMove, openResult = true) => {
    if (openResult && isFinished(nextGame) && nextGame.encerradaEm != null) {
      allowNavigation.current = true
      void navigate(historyGameUrl(nextGame.id), { replace: true })
      return
    }
    if (nextGame.lances) setMoves(nextGame.lances)
    else if (fallback) setMoves(current => [...current, fallback])
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
  }, [duration, matchClock, navigate])

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
      const controller = new AbortController()
      requests.current = controller
      const { signal } = controller
      void fetch(`${gameApi}/${game.id}`, { signal })
        .then(readGame)
        .then(confirmed => {
          if (!signal.aborted && isFinished(confirmed)) beginTurn(confirmed)
        })
        .catch(() => {
          if (!signal.aborted) setError('Não foi possível confirmar o resultado com o servidor')
        })
    }
    return true
  }, [beginTurn, finishMatch, game])

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
      if (!signal.aborted) beginTurn(nextGame)
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
      beginTurn(updatedGame, aiMove ? describeMove(currentGame.tabuleiro, updatedGame.tabuleiro, aiMove) : undefined)
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

      beginTurn(updatedGame, describeMove(game.tabuleiro, updatedGame.tabuleiro, { from, to }))
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
  const protectActiveMatch = game !== null && !gameOver
  const blocker = useBlocker(() => protectActiveMatch && !allowNavigation.current)
  const departureOpen = restartRequested || blocker.state === 'blocked'

  useEffect(() => {
    const dialog = departureDialog.current
    if (departureOpen && !dialog?.open) dialog?.showModal()
    if (!departureOpen && dialog?.open) dialog.close()
  }, [departureOpen])

  useEffect(() => {
    if (!protectActiveMatch) return
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [protectActiveMatch])

  const aiTurnPending = !!game && !gameOver && isAiGame && game.turnoAtual === 'PRETA'
  const blocked = loading || ending || gameOver || aiTurnPending || resigning !== null || promotion !== null
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
    allowNavigation.current = true
    void navigate(`/game?${params}`, { replace: true, state: { players } })
  }

  async function endByResignation(loser: Color, openResult: boolean) {
    if (!game || gameOver || expireTurn()) return true
    if (!game.configuracao) {
      finishMatch({ reason: 'Desistência', loser })
      return true
    }
    const signal = requests.current?.signal
    if (!signal || signal.aborted) return false

    setEnding(true)
    setError('')
    try {
      const response = await fetch(`${gameApi}/${game.id}/desistencia?cor=${loser}`, { method: 'POST', signal })
      const finished = await readGame(response)
      if (signal.aborted) return false
      beginTurn(finished, undefined, openResult)
      setSelected(null)
      return true
    } catch (requestError) {
      if (!signal.aborted) {
        setError(requestError instanceof Error ? requestError.message : 'Não foi possível encerrar a partida')
      }
      return false
    } finally {
      setEnding(false)
    }
  }

  async function resign() {
    if (!resigning || ending) return
    await endByResignation(resigning, true)
    resignationDialog.current?.close()
  }

  function cancelDeparture() {
    if (ending) return
    setRestartRequested(false)
    if (blocker.state === 'blocked') blocker.reset()
  }

  async function confirmDeparture() {
    if (ending || !await endByResignation(isAiGame ? 'BRANCA' : turn, false)) return
    setRestartRequested(false)
    if (blocker.state === 'blocked') blocker.proceed()
    else if (restartRequested) restart()
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
          <button className="button-secondary" onClick={() => {
            if (protectActiveMatch) {
              setError('')
              setRestartRequested(true)
            } else restart()
          }} disabled={loading || ending || !levelAvailable}>
            Nova partida
          </button>
          <button
            className="button-secondary button-danger"
            aria-haspopup="dialog"
            disabled={!game || gameOver || ending}
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
          <div className={`turn-bar${gameOver ? ' turn-ended' : ''}`}>
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

          <CapturedPieces by="PRETA" moves={moves} />
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

          <CapturedPieces by="BRANCA" moves={moves} />
          {error && !departureOpen && <p className="error-message" role="alert">{error}</p>}
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
              ? <MoveList moves={moves} />
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
        onCancel={event => { if (ending) event.preventDefault() }}
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
          <button className="button-secondary" onClick={() => resignationDialog.current?.close()} disabled={ending}>
            Continuar jogando
          </button>
          <button className="button-secondary button-danger" onClick={() => void resign()} disabled={ending}>
            Desistir
          </button>
        </div>
      </dialog>

      <dialog ref={departureDialog} className="game-dialog" aria-labelledby="departure-title"
        aria-describedby="departure-description" onCancel={event => {
          event.preventDefault()
          cancelDeparture()
        }}>
        <h2 id="departure-title">{restartRequested ? 'Iniciar outra partida?' : 'Sair da partida?'}</h2>
        <p className="muted" id="departure-description">
          {gameOver ? 'O resultado da partida já foi registrado.' : 'A partida atual será encerrada por desistência.'}
        </p>
        {error && departureOpen && <p className="error-message" role="alert">{error}</p>}
        <div className="action-buttons">
          <button className="button-secondary" onClick={cancelDeparture} disabled={ending}>Continuar jogando</button>
          <button className="button-secondary button-danger" onClick={() => void confirmDeparture()} disabled={ending}>
            {ending ? 'Encerrando…' : restartRequested ? 'Encerrar e iniciar outra' : 'Encerrar e sair'}
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
