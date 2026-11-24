import { useEffect, useState } from 'react'
import { apiRequest, type Avatar } from '../account'
import AvatarIcon from './AvatarIcon'

export default function AvatarPicker({ value, onChange, required = false, disabled = false }: {
  value: number | null
  onChange: (avatarId: number) => void
  required?: boolean
  disabled?: boolean
}) {
  const [catalog, setCatalog] = useState<Avatar[] | 'loading' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    void apiRequest<Avatar[]>('/api/avatares', { signal })
      .then(items => { if (!signal.aborted) setCatalog(items.length ? items : 'error') })
      .catch(() => { if (!signal.aborted) setCatalog('error') })
    return () => controller.abort()
  }, [attempt])

  return (
    <fieldset className="avatar-options" disabled={disabled}>
      <legend>{required ? 'Escolha seu avatar' : 'Avatar'}</legend>
      {catalog === 'loading' && <p className="muted" role="status">Carregando avatares</p>}
      {catalog === 'error' && (
        <>
          <p className="error-message" role="alert">Catálogo de avatares indisponível</p>
          <button className="button-secondary" type="button" onClick={() => {
            setCatalog('loading')
            setAttempt(current => current + 1)
          }}>Tentar novamente</button>
        </>
      )}
      {Array.isArray(catalog) && (
        <div>
          {catalog.map(avatar => (
            <label key={avatar.id}>
              <input type="radio" name="avatar" checked={value === avatar.id} required={required}
                onChange={() => onChange(avatar.id)} />
              <AvatarIcon avatar={avatar} />
              {avatar.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}
