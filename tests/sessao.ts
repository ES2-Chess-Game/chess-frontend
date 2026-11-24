import { expect, type APIRequestContext } from '@playwright/test'

export async function criarSessao(request: APIRequestContext, origin = '') {
  const username = 'jogador-' + crypto.randomUUID().slice(0, 12)
  const senha = 'xadrez-' + crypto.randomUUID()
  const catalog = await request.get(origin + '/api/avatares')
  expect(catalog.ok()).toBe(true)
  const [avatar] = await catalog.json()

  const created = await request.post(origin + '/api/auth/cadastro', {
    data: { username, email: username + '@example.test', senha, avatarId: avatar.id },
  })
  expect(created.status()).toBe(201)
  const logged = await request.post(origin + '/api/auth/login', { data: { username, senha } })
  expect(logged.status()).toBe(200)
}
