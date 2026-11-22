import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MoveClockField from '../components/MoveClockField'
import type { ClockSetting } from '../moveClock'

export default function LocalSetup() {
  const navigate = useNavigate()
  const [firstPlayer, setFirstPlayer] = useState('')
  const [secondPlayer, setSecondPlayer] = useState('')
  const [firstColor, setFirstColor] = useState('BRANCA')
  const [clockSetting, setClockSetting] = useState<ClockSetting>('0')

  function startGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const first = firstPlayer.trim()
    const second = secondPlayer.trim()
    const players = firstColor === 'BRANCA'
      ? { BRANCA: first, PRETA: second }
      : { BRANCA: second, PRETA: first }

    void navigate(clockSetting === '0' ? '/game' : `/game?time=${clockSetting}`, { state: { players } })
  }

  return (
    <main id="conteudo" tabIndex={-1} className="page setup-page">
      <Link className="back-link" to="/">← Modos de jogo</Link>
      <h1>Partida local</h1>

      <form className="setup-form" onSubmit={startGame}>
        <div className="player-fields">
          <label className="setup-field">
            Jogador 1
            <input value={firstPlayer} onChange={event => setFirstPlayer(event.target.value)} placeholder="Nome opcional" maxLength={32} />
          </label>
          <label className="setup-field">
            Jogador 2
            <input value={secondPlayer} onChange={event => setSecondPlayer(event.target.value)} placeholder="Nome opcional" maxLength={32} />
          </label>
        </div>
        <label className="setup-field">
          Cor do jogador 1
          <select value={firstColor} onChange={event => setFirstColor(event.target.value)}>
            <option value="BRANCA">Brancas</option>
            <option value="PRETA">Pretas</option>
          </select>
        </label>
        <MoveClockField value={clockSetting} onChange={setClockSetting} />
        <button type="submit" className="button-primary">Começar partida</button>
      </form>
    </main>
  )
}
