import { expect, test, type Page } from '@playwright/test'

const square = (page: Page, position: string) =>
  page.getByRole('button', { name: new RegExp(`^${position}, `) })

async function move(page: Page, from: string, to: string) {
  await square(page, from).click()
  await square(page, to).click()
}

test('partida local chega ao xeque-mate e bloqueia outros lances', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Jogar localmente' }).click()

  const status = page.getByRole('status')
  await expect(status).toHaveText('Vez das brancas')
  await move(page, 'f2', 'f3')
  await expect(status).toHaveText('Vez das pretas')
  await move(page, 'e7', 'e5')
  await expect(status).toHaveText('Vez das brancas')
  await move(page, 'g2', 'g4')
  await expect(status).toHaveText('Vez das pretas')
  await move(page, 'd8', 'h4')
  await expect(status).toContainText('Xeque-mate. Pretas vencem.')
  await expect(square(page, 'b1')).toBeDisabled()
  await expect(page.getByRole('listitem')).toHaveCount(4)
})

test('escolhe o nível básico e recebe um lance da máquina', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Jogar contra a máquina' }).click()
  await expect(page.getByRole('heading', { name: 'Escolha o nível' })).toBeVisible()
  await page.getByRole('link', { name: 'Básico' }).click()
  await expect(page).toHaveURL(/\/game\?mode=ai&level=1$/)

  await expect(square(page, 'e2')).toHaveAccessibleName('e2, peão branco')
  await move(page, 'e2', 'e4')
  await expect(square(page, 'e4')).toHaveAccessibleName('e4, peão branco')
  await expect(page.getByRole('listitem')).toHaveCount(2)
  await expect(page.getByRole('status')).toHaveText('Vez das brancas')
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
