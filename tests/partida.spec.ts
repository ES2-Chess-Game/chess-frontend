import { expect, test, type Page } from '@playwright/test'
import { criarSessao } from './sessao'

test.beforeEach(async ({ page }) => {
  await criarSessao(page.request)
})

const square = (page: Page, position: string) =>
  page.getByRole('button', { name: new RegExp(`^${position}, `) })

async function move(page: Page, from: string, to: string) {
  await square(page, from).click()
  await square(page, to).click()
}

test('partida local chega ao xeque-mate e bloqueia outros lances', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Jogar localmente' }).click()
  await page.getByRole('button', { name: 'Começar partida' }).click()

  const status = page.getByRole('status')
  await expect(status).toHaveText('Vez das brancas')
  await expect(page.getByRole('timer')).toHaveCount(0)
  await move(page, 'f2', 'f3')
  await expect(status).toHaveText('Vez das pretas')
  await move(page, 'e7', 'e5')
  await expect(status).toHaveText('Vez das brancas')
  await move(page, 'g2', 'g4')
  await expect(status).toHaveText('Vez das pretas')
  await move(page, 'd8', 'h4')
  await expect(status).toContainText('Xeque-mate · Pretas vencem')
  await expect(square(page, 'b1')).toBeDisabled()
  await expect(page.getByRole('listitem')).toHaveCount(4)
})

test('escolhe o nível básico e recebe um lance da máquina', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Desafiar a IA' }).click()
  await expect(page.getByRole('heading', { name: 'Escolha o nível' })).toBeVisible()
  await page.getByLabel('Controle de tempo').selectOption('30')
  await page.getByRole('link', { name: 'Básico' }).click()
  await expect(page).toHaveURL(/\/game\?mode=ai&difficulty=EASY&time=30$/)

  await expect(square(page, 'e2')).toHaveAccessibleName('e2, peão branco')
  await expect(page.getByRole('timer')).toBeVisible()
  await move(page, 'e2', 'e4')
  await expect(square(page, 'e4')).toHaveAccessibleName('e4, peão branco')
  await expect(page.getByRole('listitem')).toHaveCount(2)
  await expect(page.getByRole('status')).toHaveText('Vez das brancas')
  await page.getByRole('button', { name: 'Desistir da partida' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Quem desiste: Brancas')
  await expect(dialog.locator('strong')).toHaveText('Brancas')
  await dialog.getByRole('button', { name: 'Desistir', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Desistência · A IA vence')
})

test('lance ilegal mantém o tabuleiro e permite tentar novamente', async ({ page }) => {
  await page.goto('/game')
  await expect(page.getByRole('status')).toHaveText('Vez das brancas')
  await move(page, 'e2', 'e5')
  await expect(page.getByRole('alert')).toContainText('Movimento ilegal')
  await expect(square(page, 'e2')).toHaveAccessibleName('e2, peão branco')
  await expect(page.getByRole('status')).toHaveText('Vez das brancas')
  await move(page, 'e2', 'e4')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('Vez das pretas')
})

test('tabuleiro cabe na tela e permite jogar pelo teclado', async ({ page }) => {
  await page.goto('/game')
  const pawn = square(page, 'e2')
  await expect(pawn).toBeEnabled()
  await pawn.focus()
  await page.keyboard.press('Enter')
  await expect(pawn).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  const destination = square(page, 'e4')
  await expect(destination).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(destination).toHaveAccessibleName('e4, peão branco')

  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBe(dimensions.width)
})

test('atribui as cores aos jogadores e encerra a partida por desistência', async ({ page }) => {
  await page.goto('/local')
  await page.getByLabel('Jogador 1', { exact: true }).fill('Lia')
  await page.getByLabel('Jogador 2', { exact: true }).fill('Rui')
  await page.getByLabel('Cor do jogador 1').selectOption('PRETA')
  await page.getByRole('button', { name: 'Começar partida' }).click()

  const status = page.getByRole('status')
  await expect(status).toHaveText('Vez de Rui · Brancas')
  await move(page, 'e2', 'e4')
  await expect(status).toHaveText('Vez de Lia · Pretas')

  const actions = page.getByRole('group', { name: 'Ações da partida' })
  const resign = actions.getByRole('button', { name: 'Desistir da partida' })
  const dialog = page.getByRole('dialog', { name: 'Confirmar desistência' })
  const keepPlaying = dialog.getByRole('button', { name: 'Continuar jogando' })

  await resign.click()
  await expect(dialog).toContainText('Quem desiste: Lia (Pretas)')
  await expect(keepPlaying).toBeFocused()
  await keepPlaying.click()
  await expect(dialog).toBeHidden()
  await expect(resign).toBeFocused()
  await expect(square(page, 'e7')).toBeEnabled()

  await resign.click()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(square(page, 'e7')).toBeEnabled()

  await resign.click()
  await dialog.getByRole('button', { name: 'Desistir', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(status).toHaveText('Desistência · Rui vence')
  await expect(square(page, 'e7')).toBeDisabled()

  await actions.getByRole('button', { name: 'Nova partida' }).click()
  await expect(status).toHaveText('Vez de Rui · Brancas')
  await expect(square(page, 'e2')).toBeEnabled()
})

test('reinicia o cronômetro após lance válido e encerra a partida no fim do tempo', async ({ page }) => {
  await page.clock.install()
  await page.goto('/local')
  await page.getByLabel('Controle de tempo').selectOption('15')
  await page.getByRole('button', { name: 'Começar partida' }).click()

  const status = page.getByRole('status')
  const timer = page.getByRole('timer')
  await expect(timer).toHaveText('15 s')
  await page.clock.fastForward(4000)
  await expect(timer).toHaveText(/^(10|11) s$/)

  await move(page, 'e2', 'e5')
  await expect(page.getByRole('alert')).toContainText('Movimento ilegal')
  await expect(timer).toHaveText(/^(9|10|11) s$/)
  await move(page, 'e2', 'e4')
  await expect(status).toHaveText('Vez das pretas')
  await expect(timer).toHaveText('15 s')

  await page.getByRole('button', { name: 'Desistir da partida' }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirmar desistência' })
  await expect(dialog).toBeVisible()
  await page.clock.fastForward(16000)
  await expect(dialog).toBeHidden()
  await expect(timer).toHaveText('0 s')
  await expect(status).toHaveText('Tempo esgotado · Brancas vencem')
  await expect(square(page, 'e7')).toBeDisabled()
})

test('escolhe a peça da promoção e registra o lance', async ({ page }) => {
  await page.goto('/game')
  for (const [from, to] of [
    ['a2', 'a4'], ['h7', 'h6'],
    ['a4', 'a5'], ['h6', 'h5'],
    ['a5', 'a6'], ['h5', 'h4'],
    ['a6', 'b7'], ['h4', 'h3'],
  ]) {
    await move(page, from, to)
  }

  const dialog = page.getByRole('dialog', { name: 'Promover peão' })
  await move(page, 'b7', 'a8')
  await expect(dialog.getByRole('button')).toHaveCount(5)
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(square(page, 'b7')).toHaveAccessibleName('b7, peão branco')

  await move(page, 'b7', 'a8')
  await dialog.getByRole('button', { name: 'Cavalo' }).click()
  await expect(square(page, 'a8')).toHaveAccessibleName('a8, cavalo branco')
  await expect(page.getByRole('listitem').last()).toContainText('b7 → a8 ×=C')
})

test('desconta o tempo apenas do jogador da vez no relógio de partida', async ({ page }) => {
  await page.clock.install()
  await page.goto('/local')
  await page.getByLabel('Controle de tempo').selectOption('match')
  await page.getByRole('button', { name: 'Começar partida' }).click()

  const white = page.getByRole('timer', { name: 'Tempo das brancas' })
  const black = page.getByRole('timer', { name: 'Tempo das pretas' })
  await expect(white).toHaveText('Brancas 10:00')
  await expect(black).toHaveText('Pretas 10:00')
  await page.clock.fastForward(8000)
  await expect(white).toHaveText(/Brancas 9:5[12]/)
  await expect(black).toHaveText('Pretas 10:00')
  await move(page, 'e2', 'e4')
  await expect(page.getByRole('status')).toHaveText('Vez das pretas')

  const whiteAfterMove = await white.innerText()
  await page.clock.fastForward(4000)
  await expect(white).toHaveText(whiteAfterMove)
  await expect(black).toHaveText(/Pretas 9:5[56]/)
  await page.clock.fastForward(600_000)
  await expect(black).toHaveText('Pretas 0:00')
  await expect(page.getByRole('status')).toHaveText('Tempo esgotado · Brancas vencem')
})

test.describe('API com níveis e sugestões', () => {
  test.skip(process.env.CHESS_E2E_EXTENDED !== '1', 'Requer o backend com recursos publicados em /api/partidas/recursos')

  test('mostra destinos legais e atualiza as sugestões ao selecionar outra peça', async ({ page }) => {
    await page.goto('/game')
    await square(page, 'e2').click()
    await expect(square(page, 'e3')).toHaveAccessibleName('e3, vazia, lance possível')
    await expect(square(page, 'e4')).toHaveAccessibleName('e4, vazia, lance possível')
    await expect(square(page, 'e5')).toHaveAccessibleName('e5, vazia')

    await square(page, 'd2').click()
    await expect(square(page, 'd4')).toHaveAccessibleName('d4, vazia, lance possível')
    await expect(square(page, 'e4')).toHaveAccessibleName('e4, vazia')
    await square(page, 'd4').click()
    await expect(square(page, 'd4')).toHaveAccessibleName('d4, peão branco')
  })

  for (const [label, difficulty] of [['Intermediário', 'MEDIUM'], ['Avançado', 'ADVANCED']]) {
    test(`envia o nível ${label} para o motor e recebe a resposta`, async ({ page }) => {
      await page.goto('/difficulty')
      await page.getByRole('link', { name: label }).click()
      const aiResponse = page.waitForResponse(response =>
        response.request().method() === 'POST' && response.url().endsWith(`/ia?difficulty=${difficulty}`))
      await move(page, 'e2', 'e4')
      expect((await aiResponse).ok()).toBe(true)
      await expect(page.getByRole('listitem')).toHaveCount(2)
      await expect(page.getByRole('status')).toHaveText('Vez das brancas')
    })
  }
})

test.describe('partidas persistentes', () => {
  test.skip(process.env.CHESS_E2E_PERSISTENT !== '1', 'Requer o backend com persistência de partidas e sessões')

  test('retoma uma partida e recupera seus lances no histórico da sessão', async ({ page, browser }) => {
    await page.goto('/local')
    await page.getByLabel('Jogador 1', { exact: true }).fill('Lia')
    await page.getByLabel('Jogador 2', { exact: true }).fill('Rui')
    await page.getByLabel('Controle de tempo').selectOption('match')
    await page.getByRole('button', { name: 'Começar partida' }).click()
    await move(page, 'e2', 'e4')
    await expect(page.getByRole('status')).toHaveText('Vez de Rui · Pretas')

    page.once('dialog', dialog => { void dialog.accept() })
    await page.goto('/')
    await page.getByRole('link', { name: 'Retomar partida' }).click()
    await expect(page.getByRole('status')).toHaveText('Vez de Rui · Pretas')
    await expect(square(page, 'e4')).toHaveAccessibleName('e4, peão branco')
    await expect(page.getByRole('timer', { name: 'Tempo das pretas' })).toBeVisible()
    await expect(page.getByRole('listitem')).toHaveText('e2 → e4')

    await page.getByRole('button', { name: 'Desistir da partida' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Desistir', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Desistência · Lia vence')
    await page.goto('/')
    await page.getByRole('link', { name: 'Ver histórico' }).click()
    await page.getByRole('link', { name: /Desistência · Vitória · Lia/ }).click()
    await expect(page.getByRole('listitem')).toHaveText('e2 → e4')

    const other = await browser.newContext()
    try {
      const origin = new URL(page.url()).origin
      await criarSessao(other.request, origin)
      const response = await other.request.get(origin + '/api/partidas/historico')
      expect(await response.json()).toEqual([])
    } finally {
      await other.close()
    }
  })
})

test('mostra as capturas dos dois lados no tabuleiro, nos lances e no histórico', async ({ page }) => {
  await page.goto('/game')
  const board = page.getByRole('group', { name: 'Tabuleiro de xadrez' })
  await expect(square(page, 'e2')).toBeEnabled()
  const width = (await board.boundingBox())!.width
  expect(width).toBeGreaterThan(Math.min(700, page.viewportSize()!.width - 40))

  for (const [from, to] of [['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5'], ['d8', 'd5']]) {
    await move(page, from, to)
  }
  await expect(page.getByRole('group', { name: 'Capturas das brancas' })
    .getByRole('img', { name: 'peão preto' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Capturas das pretas' })
    .getByRole('img', { name: 'peão branco' })).toBeVisible()
  await expect(page.getByRole('listitem').nth(2)
    .getByRole('img', { name: 'Captura: peão preto' })).toBeVisible()
  await expect(page.getByRole('listitem').nth(3)
    .getByRole('img', { name: 'Captura: peão branco' })).toBeVisible()

  await page.getByRole('button', { name: 'Desistir da partida' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Desistir', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Desistência')
  await page.getByRole('link', { name: 'Skynet Chess, início' }).click()
  await page.getByRole('link', { name: 'Ver histórico' }).click()
  await page.getByRole('link', { name: /Desistência/ }).click()
  await expect(page.getByRole('img', { name: 'Captura: peão preto' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Captura: peão branco' })).toBeVisible()
})

test('confirma a saída por Escolher nível, Voltar e Nova partida', async ({ page }) => {
  await page.goto('/difficulty')
  await page.getByRole('link', { name: 'Básico' }).click()
  await expect(square(page, 'e2')).toBeEnabled()

  const exit = page.getByRole('dialog', { name: 'Sair da partida?' })
  await page.getByRole('link', { name: /Escolher nível/ }).click()
  await expect(exit).toBeVisible()
  await exit.getByRole('button', { name: 'Continuar jogando' }).click()
  await expect(exit).toBeHidden()
  await expect(square(page, 'e2')).toBeEnabled()

  await page.getByRole('button', { name: 'Nova partida' }).click()
  const restart = page.getByRole('dialog', { name: 'Iniciar outra partida?' })
  await expect(restart).toBeVisible()
  await restart.getByRole('button', { name: 'Continuar jogando' }).click()
  await expect(restart).toBeHidden()

  await page.goBack()
  await expect(exit).toBeVisible()
  await exit.getByRole('button', { name: 'Encerrar e sair' }).click()
  await expect(page.getByRole('heading', { name: 'Escolha o nível' })).toBeVisible()
  await page.getByRole('link', { name: 'Meu perfil' }).click()
  await expect(page.getByRole('link', { name: 'Retomar partida' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Desistência · Vitória · IA/ })).toBeVisible()
})
