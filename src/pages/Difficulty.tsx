import { useState } from 'react'
import { Link } from 'react-router-dom'
import AiIcon from '../components/AiIcon'
import MoveClockField from '../components/MoveClockField'
import { aiLevels, useGameCapabilities } from '../gameCapabilities'
import type { ClockSetting } from '../moveClock'

export default function Difficulty() {
  const [clockSetting, setClockSetting] = useState<ClockSetting>('0')
  const capabilities = useGameCapabilities()
  const time = clockSetting === '0' ? '' : `&time=${clockSetting}`

  return (
    <main id="conteudo" tabIndex={-1} className="page setup-page">
      <Link className="back-link" to="/">← Modos de jogo</Link>
      <h1 className="ai-heading"><AiIcon />Escolha o nível</h1>

      <div className="setup-form">
        <MoveClockField value={clockSetting} onChange={setClockSetting} />
      </div>
      <ul className="level-list" aria-busy={capabilities === null}>
        {aiLevels.map(level => capabilities?.niveisIa.includes(level.id) ? (
          <li key={level.id}>
            <Link
              className={`mode-link${level.id === 'EASY' ? ' mode-primary' : ''}`}
              to={`/game?mode=ai&difficulty=${level.id}${time}`}
            >
              <strong>{level.label}</strong>
              <span className="mode-arrow" aria-hidden="true">↗</span>
            </Link>
          </li>
        ) : (
          <li key={level.id} className="level-unavailable">
            <strong>{level.label}</strong><span>{capabilities ? 'Indisponível' : 'Carregando'}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
