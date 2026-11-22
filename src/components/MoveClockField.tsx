import { clockOptions, readClockSetting, type ClockSetting } from '../moveClock'

export default function MoveClockField({ value, onChange }: {
  value: ClockSetting
  onChange: (setting: ClockSetting) => void
}) {
  return (
    <label className="setup-field">
      Controle de tempo
      <select value={value} onChange={event => onChange(readClockSetting(event.target.value))}>
        {clockOptions.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}
