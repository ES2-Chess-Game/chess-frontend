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
  await page.getByRole('radio', { name: 'Rainha' }).check()
  const registration = page.waitForResponse(response => response.url().endsWith('/api/auth/cadastro'))
  const login = page.waitForResponse(response => response.url().endsWith('/api/auth/login'))
  await page.getByRole('button', { name: 'Criar conta' }).click()
  expect((await registration).status()).toBe(201)
  expect((await login).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible()
  await expect(page.getByText('Nenhuma partida encerrada ainda')).toBeVisible()
  if (resources.ranking) {
    await expect(page.locator('.profile-identity img')).toHaveAttribute('src', '/avatares/queen.svg')
  }

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
  page.once('dialog', dialog => { void dialog.accept() })
  await page.goto('/')
  await page.getByRole('link', { name: 'Retomar partida' }).click()
  await expect(page.getByRole('listitem').first()).toHaveText('e2 → e4')
  await page.getByRole('button', { name: 'Desistir da partida' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Desistir', exact: true }).click()
  await expect(page).toHaveURL(/\/historico\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Vitória de Skynet' })).toBeVisible()
  await page.getByRole('link', { name: 'Meu perfil' }).click()

  await expect(page.getByRole('link', { name: 'Retomar partida' })).toHaveCount(0)
  const finished = page.getByRole('link', { name: /Desistência · Vitória · Skynet/ })
  const historyPath = await finished.getAttribute('href')
  expect(historyPath).toMatch(/^\/historico\//)
  await expect(page.getByText('Derrotas', { exact: true }).locator('..').locator('dd')).toHaveText('1')
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(page.getByRole('heading', { name: 'Entrar no Skynet Chess' })).toBeVisible()

  const secondSession = await browser.newPage()
  try {
    const base = page.url()
    const detailApi = new URL('/api/partidas' + historyPath, base).href
    expect((await secondSession.request.get(detailApi)).status()).toBe(resources.ranking ? 401 : 404)
    await secondSession.goto(new URL('/conta', base).href)
    await secondSession.getByLabel('Nome de usuário').fill(updated)
    await secondSession.getByLabel('Senha').fill(password)
    await secondSession.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(secondSession.locator('.profile-identity img')).toHaveAttribute('src', '/avatares/knight.svg')
    await secondSession.getByRole('link', { name: 'Ver histórico completo' }).click()
    await secondSession.getByRole('link', { name: /Desistência · Vitória · Skynet/ }).click()
    await expect(secondSession.getByRole('listitem').first()).toHaveText('e2 → e4')
  } finally {
    await secondSession.close()
  }
})

test('redireciona os modos de jogo para o login e abre o ranking geral', async ({ page }) => {
  await page.goto('/')
  for (const name of ['Jogar localmente', 'Desafiar a IA']) {
    await page.getByRole('link', { name }).click()
    await expect(page).toHaveURL(/\/conta$/)
    await expect(page.getByRole('heading', { name: 'Entrar no Skynet Chess' })).toBeVisible()
    await page.getByRole('link', { name: /Modos de jogo/ }).click()
  }
  await page.goto('/game?mode=ai&difficulty=EASY')
  await expect(page).toHaveURL(/\/conta$/)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  const username = 'ranking-' + crypto.randomUUID().slice(0, 8)
  await page.getByLabel('Nome de usuário').fill(username)
  await page.getByLabel('E-mail').fill(username + '@example.test')
  await page.getByLabel('Senha').fill('xadrez-' + crypto.randomUUID())
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL(/\/conta$/)
  await page.getByRole('radio', { name: 'Rei' }).check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL(/\/game\?mode=ai&difficulty=EASY$/)
  await expect(page.getByRole('button', { name: 'e2, peão branco' })).toBeVisible()
  const resources = await (await page.request.get('/api/partidas/recursos')).json()
  if (resources.ranking) {
    await page.getByRole('link', { name: 'Ranking' }).click()
    await page.getByRole('dialog', { name: 'Sair da partida?' })
      .getByRole('button', { name: 'Encerrar e sair' }).click()
    await expect(page.getByRole('heading', { name: 'Ranking do Skynet Chess' })).toBeVisible()
    const row = page.getByRole('row').filter({ hasText: username })
    await expect(row).toContainText('Você')
    await expect(row.locator('img')).toHaveAttribute('src', '/avatares/king.svg')
    await expect(row.getByRole('cell').last()).toHaveText('0')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  }
})
