import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers'

/**
 * Dates RELATIVES à aujourd'hui, même convention que `gantt-drag.spec.ts` : la plage affichée
 * est calculée autour du jour courant et la vue recentrée dessus. Des dates en dur sortiraient
 * du champ de vision au bout de quelques semaines et le glissement viserait le vide.
 */
function isoInDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function addTask(page: Page, title: string, startInDays: number, endInDays: number) {
  await page.getByRole('button', { name: '+ Tâche' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Titre').fill(title)
  await d.getByLabel('Début').fill(isoInDays(startInDays))
  await d.getByLabel('Fin').fill(isoInDays(endInDays))
  await d.getByRole('button', { name: 'Créer' }).click()
  const bar = page.locator('[data-task-id]', { hasText: title })
  await expect(bar).toHaveCount(1)
  // Les coordonnées de souris calculées plus bas viseraient hors écran si la barre n'était pas
  // dans le champ de vision : `toBeVisible` ne le dit pas (une boîte à x négatif est « visible »).
  await expect(bar).toBeInViewport()
  return bar
}

async function linkByDrag(page: Page, fromTitle: string, toTitle: string) {
  const from = page.locator('[data-task-id]', { hasText: fromTitle })
  const to = page.locator('[data-task-id]', { hasText: toTitle })
  const handle = from.getByRole('button', { name: 'Créer une dépendance' })
  const h = (await handle.boundingBox())!
  const t = (await to.boundingBox())!
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
  await page.mouse.down()
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(`Deps ${Date.now()}`)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
  await addTask(page, 'A', 4, 6)
  await addTask(page, 'B', 10, 12)
})

test('créer une dépendance par drag, refuser le cycle, supprimer au clavier', async ({ page }) => {
  await linkByDrag(page, 'A', 'B')
  await expect(page.locator('svg [data-dep-id]')).toHaveCount(1)

  await linkByDrag(page, 'B', 'A')
  await expect(page.getByText('Dépendance refusée : cela créerait un cycle')).toBeVisible()
  await expect(page.locator('svg [data-dep-id]')).toHaveCount(1)

  await linkByDrag(page, 'A', 'B')
  await expect(page.getByText('Cette dépendance existe déjà')).toBeVisible()

  await page.locator('svg [data-dep-id]').last().dispatchEvent('click')
  await page.keyboard.press('Delete')
  await expect(page.locator('svg [data-dep-id]')).toHaveCount(0)

  // La suppression est PERSISTÉE, pas seulement retirée du dessin.
  await page.reload()
  await expect(page.locator('svg [data-dep-id]')).toHaveCount(0)
})

test('Suppr supprime la tâche sélectionnée après confirmation, Échap désélectionne', async ({ page }) => {
  const a = page.locator('[data-task-id]', { hasText: 'A' })
  await a.click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-task-id]')).toHaveCount(2)

  await a.click()
  page.once('dialog', (d) => d.accept())
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-task-id]')).toHaveCount(1)

  await page.reload()
  await expect(page.locator('[data-task-id]')).toHaveCount(1)
})
