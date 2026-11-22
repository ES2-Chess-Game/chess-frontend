import { type AiDifficulty } from './gameCapabilities'
import type { ClockSetting } from './moveClock'

export type PlayerColor = 'BRANCA' | 'PRETA'
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
  peca: string
  promocao?: string | null
  captura?: string | null
}
export type SavedGame = {
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
