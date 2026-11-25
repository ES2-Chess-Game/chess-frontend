import { type AiDifficulty } from './gameCapabilities'
import type { ClockSetting } from './moveClock'

export type PlayerColor = 'BRANCA' | 'PRETA'
export type PieceType = 'PEAO' | 'TORRE' | 'CAVALO' | 'BISPO' | 'RAINHA' | 'REI'

export const pieceSymbols: Record<PieceType, string> = {
  REI: '♚', RAINHA: '♛', TORRE: '♜', BISPO: '♝', CAVALO: '♞', PEAO: '♟',
}
const pieceNames: Record<PieceType, string> = {
  REI: 'rei', RAINHA: 'rainha', TORRE: 'torre', BISPO: 'bispo', CAVALO: 'cavalo', PEAO: 'peão',
}

export function pieceLabel(type: PieceType, color: PlayerColor) {
  const feminine = type === 'RAINHA' || type === 'TORRE'
  const name = color === 'BRANCA' ? 'branc' : 'pret'
  return `${pieceNames[type]} ${name}${feminine ? 'a' : 'o'}`
}
export type SavedSettings = {
  modo: 'local' | 'ai'
  dificuldade?: AiDifficulty | null
  tempo: ClockSetting
  brancas: string
  pretas: string
}
export type SavedMove = {
  origem: { row: number; col: number }
  destino: { row: number; col: number }
  cor?: PlayerColor
  peca: PieceType
  promocao?: PieceType | null
  captura?: PieceType | null
}
export type BoardPiece = { tipo: PieceType; cor: PlayerColor }
export type SavedGame = {
  tabuleiro?: (BoardPiece | null)[][]
  id: string
  status: string
  vencedor?: PlayerColor | null
  configuracao?: SavedSettings
  lances?: SavedMove[]
  criadaEm?: number
  encerradaEm?: number | null
  brancasMs?: number | null
  pretasMs?: number | null
}

export function capturedPiece(move: SavedMove, index: number) {
  if (!move.captura) return null
  const by = move.cor ?? (index % 2 === 0 ? 'BRANCA' : 'PRETA')
  const color: PlayerColor = by === 'BRANCA' ? 'PRETA' : 'BRANCA'
  return { type: move.captura, by, color }
}

export function isFinished(game: SavedGame) {
  return game.status !== 'EM_ANDAMENTO' && game.status !== 'XEQUE'
}

export function savedMoveText(move: SavedMove) {
  const from = move.origem
  const to = move.destino
  if (move.peca === 'REI' && to.row === from.row && Math.abs(to.col - from.col) === 2) {
    return to.col > from.col ? 'O-O' : 'O-O-O'
  }
  const files = 'abcdefgh'
  const promotion: Record<string, string> = { RAINHA: 'D', TORRE: 'T', BISPO: 'B', CAVALO: 'C' }
  const promoted = move.promocao && promotion[move.promocao]
  return `${files[from.col]}${8 - from.row} → ${files[to.col]}${8 - to.row}${move.captura ? ' ×' : ''}${promoted ? `=${promoted}` : ''}`
}

export function resumeGameUrl(game: SavedGame) {
  const query = new URLSearchParams({ resume: game.id })
  const settings = game.configuracao
  if (settings?.modo === 'ai') {
    query.set('mode', 'ai')
    if (settings.dificuldade) query.set('difficulty', settings.dificuldade)
  }
  if (settings?.tempo && settings.tempo !== '0') query.set('time', settings.tempo)
  return `/game?${query}`
}

const gameStatuses: Record<string, string> = {
  XEQUE_MATE: 'Xeque-mate', EMPATE: 'Empate', TEMPO_ESGOTADO: 'Tempo esgotado', DESISTENCIA: 'Desistência',
}
export const gameDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function historyGameUrl(id: string) {
  return `/historico/${encodeURIComponent(id)}`
}

export function gameStatusText(game: SavedGame) {
  return gameStatuses[game.status] ?? 'Partida encerrada'
}

export function gamePlayerName(game: SavedGame, color: PlayerColor) {
  if (color === 'BRANCA') return game.configuracao?.brancas || 'Brancas'
  return game.configuracao?.pretas || (game.configuracao?.modo === 'ai' ? 'Skynet' : 'Pretas')
}

export function gameResult(game: SavedGame) {
  const result = game.vencedor ? `Vitória · ${gamePlayerName(game, game.vencedor)}` : undefined
  return [gameStatusText(game), result].filter(Boolean).join(' · ')
}
