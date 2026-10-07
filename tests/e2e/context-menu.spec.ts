import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers'

function isoInDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function createProject(page: Page, name: string) {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
}

async function createTask(page: Page, title: string, start: string, end: string) {
  await page.getByRole('button', { name: '+ Tâche' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await dialog.getByLabel('Titre').fill(title)
  await dialog.getByLabel('Début').fill(start)
  await dialog.getByLabel('Fin').fill(end)
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click()
  await expect(page.locator('[data-row-task-id]', { hasText: title })).toHaveCount(1)
}

test('clic droit sur une tâche : dupliquer, puis supprimer avec confirmation', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Menu ${Date.now()}`)
  await createTask(page, 'Cadrage', isoInDays(0), isoInDays(3))

  const row = page.locator('[data-row-task-id]', { hasText: 'Cadrage' })
  await row.click({ button: 'right' })
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  // Le clic droit sélectionne sa cible, comme dans un logiciel de bureau.
  await expect(row).toHaveClass(/bg-yellow/)
  await menu.getByRole('menuitem', { name: 'Dupliquer' }).click()
  await expect(menu).toHaveCount(0)
  await expect(page.locator('[data-row-task-id]', { hasText: 'Cadrage (copie)' })).toHaveCount(1)

  // La copie est rangée juste après l'original.
  const titles = await page.locator('[data-row-task-id] span.flex-1').allInnerTexts()
  expect(titles).toEqual(['Cadrage', 'Cadrage (copie)'])

  // Suppression depuis la BARRE cette fois (le menu s'ouvre aussi sur la frise), refusée puis acceptée.
  const bar = page.locator('[data-task-id]', { hasText: 'Cadrage (copie)' })
  page.once('dialog', (d) => d.dismiss())
  await bar.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await expect(page.locator('[data-row-task-id]')).toHaveCount(2)

  page.once('dialog', (d) => d.accept())
  await bar.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await expect(page.locator('[data-row-task-id]')).toHaveCount(1)
})

test('clic droit sur le fond de la frise : créer une tâche à la date visée', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Fond ${Date.now()}`)

  // Le fond de la frise n'accepte le clic que hors des barres : sur un projet vide, n'importe où.
  const scroll = page.getByTestId('gantt-scroll')
  const box = (await scroll.boundingBox())!
  await page.mouse.click(box.x + box.width - 120, box.y + box.height - 60, { button: 'right' })
  const item = page.getByRole('menuitem', { name: /^Nouvelle tâche le / })
  await expect(item).toBeVisible()
  await item.click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await expect(dialog).toBeVisible()
  // La date proposée est bien celle sous le pointeur : elle n'est pas aujourd'hui, puisqu'on a
  // cliqué loin à droite du recentrage initial.
  const start = await dialog.getByLabel('Début').inputValue()
  expect(start).not.toBe(isoInDays(0))
  expect(start > isoInDays(0)).toBe(true)
})

test('clic droit sur une flèche : supprimer le lien ; un lecteur n’a pas de menu', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Lien ${Date.now()}`)
  await createTask(page, 'A', isoInDays(0), isoInDays(2))
  await page.locator('[data-row-task-id]', { hasText: 'A' }).getByRole('button', { name: 'Ajouter après « A »' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await dialog.getByLabel('Titre').fill('B')
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click()
  await expect(page.locator('[data-dep-id]')).toHaveCount(1)

  await page.locator('[data-dep-id]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Supprimer le lien' }).click()
  await expect(page.locator('[data-dep-id]')).toHaveCount(0)

  // Échap ferme un menu ouvert sans rien faire.
  await page.locator('[data-row-task-id]', { hasText: 'A' }).click({ button: 'right' })
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.locator('[data-row-task-id]')).toHaveCount(2)
})

test('le ⋯ d\'une ligne ouvre le même menu que le clic droit, et Échap rend le focus', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Points ${Date.now()}`)
  await createTask(page, 'Cadrage', isoInDays(0), isoInDays(3))

  const row = page.locator('[data-row-task-id]', { hasText: 'Cadrage' })
  const dots = row.getByRole('button', { name: 'Actions de « Cadrage »' })
  // Révélé au survol de la ligne, par l'opacité : le bouton existe déjà dans le document.
  await expect(dots).toHaveCSS('opacity', '0')
  await row.hover()
  await expect(dots).toHaveCSS('opacity', '1')

  await dots.click()
  const menu = page.getByRole('menu')
  // Premier item du menu d'une tâche (`buildMenuItems`) : « Modifier… ».
  await expect(menu.getByRole('menuitem', { name: 'Modifier…' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(dots).toBeFocused()

  await dots.click()
  await page.getByRole('menuitem', { name: 'Dupliquer' }).click()
  await expect(page.locator('[data-row-task-id]', { hasText: 'Cadrage (copie)' })).toHaveCount(1)
})
