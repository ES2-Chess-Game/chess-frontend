export type Avatar = { id: number; name: string; image: string }
export type Account = { id: number; username: string; email: string; avatar: Avatar | null }
export type Profile = Account & { estatisticas: { vitorias: number; derrotas: number; empates: number } }
export type Session = { status: 'loading' | 'guest' | 'unavailable' } | { status: 'signed-in'; account: Account }

export class AccountRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: 'no-store', ...init })
  if (response.ok && response.status === 204) return undefined as T
  const type = response.headers.get('Content-Type') ?? ''
  const data = type.includes('application/json') ? await response.json().catch(() => null) : null
  if (response.ok && data !== null) return data as T

  const message = typeof data?.erro === 'string' ? data.erro.trimEnd().replace(/[.!?…]+$/, '') : ''
  throw new AccountRequestError(response.status, message || 'Não foi possível concluir a solicitação')
}

export function jsonRequest(method: string, payload: object): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
}

export async function readSession(signal: AbortSignal): Promise<Session> {
  try {
    const account = await apiRequest<Account>('/api/auth/me', { signal })
    return { status: 'signed-in', account }
  } catch (error) {
    return error instanceof AccountRequestError && error.status === 401
      ? { status: 'guest' }
      : { status: 'unavailable' }
  }
}
