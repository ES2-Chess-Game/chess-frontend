export const clockOptions = [
  { value: '0', label: 'Sem cronômetro' },
  { value: '15', label: '15 segundos por jogada' },
  { value: '30', label: '30 segundos por jogada' },
  { value: '60', label: '60 segundos por jogada' },
  { value: 'match', label: '10 minutos por jogador' },
] as const

export type ClockSetting = (typeof clockOptions)[number]['value']

export function readClockSetting(value: string | null): ClockSetting {
  return clockOptions.find(option => option.value === value)?.value ?? '0'
}

export function clockDuration(setting: ClockSetting) {
  return setting === 'match' ? 600_000 : Number(setting) * 1000
}

export function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
