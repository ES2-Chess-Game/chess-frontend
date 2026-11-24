import { useState, type FormEvent } from 'react'
import { apiRequest, jsonRequest, type Profile } from '../account'
import AvatarPicker from './AvatarPicker'

export default function ProfileEditor({ profile, onSave, onCancel }: {
  profile: Profile
  onSave: (profile: Profile) => void
  onCancel: () => void
}) {
  const [avatarId, setAvatarId] = useState(profile.avatar?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setSaving(true)
    setError('')
    try {
      const updated = await apiRequest<Profile>('/api/perfil', jsonRequest('PUT', {
        username: String(data.get('username')).trim(),
        email: String(data.get('email')).trim(),
        avatarId,
      }))
      onSave(updated)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar o perfil')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="setup-form" onSubmit={event => void submit(event)}>
      <label className="setup-field">
        Nome de usuário
        <input name="username" autoComplete="username" defaultValue={profile.username} required minLength={3} maxLength={30} />
      </label>
      <label className="setup-field">
        E-mail
        <input name="email" type="email" autoComplete="email" defaultValue={profile.email} required maxLength={254} />
      </label>
      <AvatarPicker value={avatarId} onChange={setAvatarId} disabled={saving} />
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="action-buttons">
        <button className="button-primary" disabled={saving}>{saving ? 'Salvando' : 'Salvar perfil'}</button>
        <button className="button-secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
      </div>
    </form>
  )
}
