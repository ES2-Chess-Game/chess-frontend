import { useState, type FormEvent } from 'react'
import AvatarPicker from './AvatarPicker'
import { apiRequest, jsonRequest, type Account } from '../account'

export default function AccountForm({ onSignIn, continuingGame }: {
  onSignIn: (account: Account) => void
  continuingGame: boolean
}) {
  const [register, setRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [avatarId, setAvatarId] = useState<number | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const username = String(form.get('username')).trim()
    const senha = String(form.get('senha'))
    if (register && avatarId === null) {
      setError('Escolha um avatar para criar sua conta')
      return
    }
    let registered = false
    setLoading(true)
    setError('')
    try {
      if (register) {
        await apiRequest<Account>('/api/auth/cadastro', jsonRequest('POST', {
          username, senha, email: String(form.get('email')).trim(), avatarId,
        }))
        registered = true
      }
      const account = await apiRequest<Account>('/api/auth/login', jsonRequest('POST', { username, senha }))
      onSignIn(account)
    } catch (error) {
      if (registered) setRegister(false)
      setError(registered
        ? 'Conta criada. Entre com sua senha para continuar'
        : error instanceof Error ? error.message : 'Não foi possível acessar a conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1>{register ? 'Criar conta' : 'Entrar no Skynet Chess'}</h1>
      {!register && continuingGame && <p className="muted">Entre ou crie uma conta para jogar.</p>}
      <form className="setup-form" onSubmit={event => void submit(event)}>
        <label className="setup-field">
          Nome de usuário
          <input name="username" autoComplete="username" required minLength={register ? 3 : undefined} maxLength={30} />
        </label>
        {register && (
          <label className="setup-field">
            E-mail
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
        )}
        <label className="setup-field">
          Senha
          <input key={String(register)} name="senha" type="password" autoComplete={register ? 'new-password' : 'current-password'}
            required minLength={register ? 8 : undefined} maxLength={72} />
        </label>
        {register && <AvatarPicker required value={avatarId} onChange={setAvatarId} disabled={loading} />}
        {error && <p role="alert" className="error-message">{error}</p>}
        <button className="button-primary" disabled={loading}>
          {loading ? 'Aguarde' : register ? 'Criar conta' : 'Entrar'}
        </button>
        <button className="button-secondary" type="button" disabled={loading} onClick={() => {
          setRegister(!register)
          setError('')
        }}>
          {register ? 'Já tenho conta' : 'Criar conta'}
        </button>
      </form>
    </>
  )
}
