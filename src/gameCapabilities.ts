import { useEffect, useState } from 'react'

export const gameApi = '/api/partidas'

export const aiLevels = [
  { id: 'EASY', label: 'Básico' },
  { id: 'MEDIUM', label: 'Intermediário' },
  { id: 'ADVANCED', label: 'Avançado' },
] as const

export type AiDifficulty = (typeof aiLevels)[number]['id']
type Capabilities = { niveisIa: AiDifficulty[]; sugestoesDeLances: boolean; partidasPersistentes: boolean }

const basicCapabilities: Capabilities = { niveisIa: ['EASY'], sugestoesDeLances: false, partidasPersistentes: false }

export function readAiDifficulty(value: string | null) {
  return aiLevels.find(level => level.id === value) ?? aiLevels[0]
}

export function useGameCapabilities() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadCapabilities() {
      let available = basicCapabilities
      try {
        const response = await fetch(`${gameApi}/recursos`, { signal: controller.signal })
        if (response.ok) {
          const data = await response.json() as Partial<Capabilities>
          const supported = Array.isArray(data?.niveisIa) ? data.niveisIa : []
          available = {
            niveisIa: aiLevels.filter(level => supported.includes(level.id)).map(level => level.id),
            sugestoesDeLances: data?.sugestoesDeLances === true,
            partidasPersistentes: data?.partidasPersistentes === true,
          }
        }
      } catch {
        // A API anterior já permite partidas locais e o nível básico
      }
      if (!controller.signal.aborted) setCapabilities(available)
    }

    void loadCapabilities()
    return () => controller.abort()
  }, [])

  return capabilities
}
