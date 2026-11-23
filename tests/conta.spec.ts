import { expect, test } from '@playwright/test'

test('cria conta, escolhe avatar e recupera a partida em outra sessão', async ({ page, browser }) => {
  test.setTimeout(55_000)
  const capabilities = await page.request.get('/api/partidas/recursos')
  const resources = await capabilities.json()
  test.skip(!resources.perfilComEstatisticas && process.env.CHESS_E2E_PROFILE !== '1',
    'Requer o backend com histórico e estatísticas da conta')
  expect(resources.perfilComEstatisticas).toBe(true)

  const username = 'clube-' + crypto.randomUUID().slice(0, 8)
  const updated = username + '-64'
  const password = 'xadrez-' + crypto.randomUUID()
  await page.goto('/')
  await page.getByRole('link', { name: 'Entrar', exact: true }).click()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await page.getByLabel('Nome de usuário').fill(username)
  await page.getByLabel('E-mail').fill(username + '@example.test')
  await page.getByLabel('Senha').fill(password)
  const registration = page.waitForResponse(response => response.url().endsWith('/api/auth/cadastro'))
  const login = page.waitForResponse(response => response.url().endsWith('/api/auth/login'))
  await page.getByRole('button', { name: 'Criar conta' }).click()
  expect((await registration).status()).toBe(201)
  expect((await login).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible()
  await expect(page.getByText('Nenhuma partida encerrada ainda')).toBeVisible()

  await page.getByRole('button', { name: 'Editar perfil' }).click()
  await page.getByLabel('Nome de usuário').fill(updated)
  await page.getByRole('radio', { name: 'Cavalo' }).check()
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByRole('heading', { name: updated })).toBeVisible()

  await page.goto('/difficulty')
  await page.getByRole('link', { name: 'Básico' }).click()
  await page.getByRole('button', { name: 'e2, peão branco' }).click()
  await page.getByRole('button', { name: /^e4, / }).click()
  await expect(page.getByRole('listitem')).toHaveCount(2)
  await page.getByRole('link', { name: 'Meu perfil' }).click()
  await page.getByRole('link', { name: 'Retomar partida' }).click()
  await expect(page.getByRole('listitem').first()).toHaveText('e2 → e4')
  await page.getByRole('button', { name: 'Desistir da partida' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Desistir', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Desistência · A IA vence')
  await page.getByRole('link', { name: 'Meu perfil' }).click()

  const finished = page.getByRole('link', { name: /Desistência · Vitória · IA/ })
  const historyPath = await finished.getAttribute('href')
  expect(historyPath).toMatch(/^\/historico\//)
  await expect(page.getByText('Derrotas', { exact: true }).locator('..').locator('dd')).toHaveText('1')
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(page.getByRole('heading', { name: 'Entrar no Clube 64' })).toBeVisible()

  const secondSession = await browser.newPage()
  try {
    const base = page.url()
    const detailApi = new URL('/api/partidas' + historyPath, base).href
    expect((await secondSession.request.get(detailApi)).status()).toBe(404)
    await secondSession.goto(new URL('/conta', base).href)
    await secondSession.getByLabel('Nome de usuário').fill(updated)
    await secondSession.getByLabel('Senha').fill(password)
    await secondSession.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(secondSession.locator('.profile-identity img')).toHaveAttribute('src', '/avatares/knight.svg')
    await secondSession.getByRole('link', { name: 'Ver histórico completo' }).click()
    await secondSession.getByRole('link', { name: /Desistência · Vitória · IA/ }).click()
    await expect(secondSession.getByRole('listitem').first()).toHaveText('e2 → e4')
  } finally {
    await secondSession.close()
  }
})
