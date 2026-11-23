import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest, jsonRequest, type Avatar, type Profile } from '../account'
import AvatarIcon from './AvatarIcon'

export default function ProfileEditor({ profile, onSave, onCancel }: {
  profile: Profile
  onSave: (profile: Profile) => void
  onCancel: () => void
}) {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [avatarId, setAvatarId] = useState(profile.avatar?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void apiRequest<Avatar[]>('/api/avatares', { signal: controller.signal })
      .then(items => { if (!controller.signal.aborted) setAvatars(items) })
      .catch(() => { if (!controller.signal.aborted) setError('Catálogo de avatares indisponível') })
    return () => controller.abort()
  }, [])

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
      {avatars.length > 0 && (
        <fieldset className="avatar-options">
          <legend>Avatar</legend>
          <div>
            {avatars.map(avatar => (
              <label key={avatar.id}>
                <input type="radio" name="avatar" checked={avatarId === avatar.id} onChange={() => setAvatarId(avatar.id)} />
                <AvatarIcon avatar={avatar} />
                {avatar.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="action-buttons">
        <button className="button-primary" disabled={saving}>{saving ? 'Salvando' : 'Salvar perfil'}</button>
        <button className="button-secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
      </div>
    </form>
  )
}
