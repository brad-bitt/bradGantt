import { test, expect, devices } from '@playwright/test'
import { loginAs } from './helpers'

/**
 * Un téléphone en portrait : écran étroit, pas de survol, pointeur grossier. `isMobile` fait
 * aussi passer le navigateur en émulation mobile, d'où `(hover: none)` pour les commandes
 * révélées au toucher.
 */
test.use({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } })

const DEMO = '/projects/c0000000-0000-0000-0000-000000000001'

test('la liste et la connexion tiennent dans la largeur du téléphone', async ({ page }) => {
  await page.goto('/login')
  // Aucun défilement horizontal du document : c'est la définition d'une page qui « tient ».
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await expect(page.getByRole('button', { name: /Passer au thème/ })).toBeVisible()

  await loginAs(page, 'alice')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await expect(page.getByRole('button', { name: 'Menu du compte' })).toBeInViewport()
  await expect(page.getByTestId('projects-overview')).toBeVisible()
})

test('le diagramme se lit en portrait : sidebar réduite, aujourd’hui visible, commandes au toucher', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto(DEMO)

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  // La sidebar laisse plus de la moitié de l'écran à la frise.
  const sidebar = (await page.getByTestId('gantt-sidebar').boundingBox())!
  expect(sidebar.width).toBeLessThan(390 / 2)

  // Le recentrage initial tient compte de cette largeur : aujourd'hui est dans la partie visible.
  const today = (await page.getByTestId('today-line').boundingBox())!
  expect(today.x).toBeGreaterThan(sidebar.width)
  expect(today.x).toBeLessThan(390)

  // Sans survol possible, les commandes de ligne sont visibles d'emblée — par l'opacité, la
  // seule chose qui change entre bureau et toucher.
  const after = page.locator('[data-row-task-id]', { hasText: 'Ateliers' }).getByRole('button', { name: 'Ajouter après « Ateliers »' })
  await expect(after).toHaveCSS('opacity', '1')

  // Le conseil de rotation s'affiche en portrait et se ferme pour la session.
  const hint = page.getByTestId('rotate-hint')
  await expect(hint).toBeVisible()
  await hint.getByRole('button', { name: 'Fermer ce conseil' }).click()
  await expect(hint).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('rotate-hint')).toHaveCount(0)
})

test('en paysage, le diagramme retrouve sa mise en page de bureau', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await loginAs(page, 'alice')
  await page.goto(DEMO)

  const sidebar = (await page.getByTestId('gantt-sidebar').boundingBox())!
  expect(sidebar.width).toBe(300)
  // Le conseil est dans le document (il ne dépend que d'une media query CSS), mais invisible.
  await expect(page.getByTestId('rotate-hint')).toBeHidden()
  // La barre de synthèse s'efface sur une fenêtre basse : la place va au diagramme.
  await expect(page.getByTestId('gantt-summary')).toBeHidden()
  // Trois lignes au moins restent visibles sous l'en-tête et la barre d'outils.
  const rows = page.locator('[data-row-task-id]')
  await expect(rows.nth(2)).toBeInViewport()
})
