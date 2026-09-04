import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers'

const rows = (page: Page) => page.locator('[data-row-task-id]')

/** Les lignes portent aussi la poignée et le chevron : on ne compare donc que le titre. */
const titles = (...t: string[]) => t.map((x) => new RegExp(x))

test('groupe : créer, ajouter un enfant, replier, réordonner', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(`Groupes ${Date.now()}`)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)

  await page.getByRole('button', { name: '+ Groupe' }).click()
  await page.getByRole('dialog').getByLabel('Titre').fill('Phase 1')
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await expect(rows(page)).toHaveCount(1)

  const group = rows(page).filter({ hasText: 'Phase 1' })
  for (const enfant of ['Enfant A', 'Enfant B']) {
    await group.getByRole('button', { name: 'Ajouter une tâche au groupe' }).click()
    const d = page.getByRole('dialog')
    await d.getByLabel('Titre').fill(enfant)
    // Le groupe d'accueil est prérempli par le bouton « + » : c'est tout son intérêt.
    await expect(d.getByLabel('Groupe')).toHaveValue(/[0-9a-f-]{36}/)
    await d.getByRole('button', { name: 'Créer' }).click()
    await expect(rows(page).filter({ hasText: enfant })).toHaveCount(1)
  }

  await expect(rows(page)).toHaveText(titles('Phase 1', 'Enfant A', 'Enfant B'))
  // La barre de groupe couvre ses enfants : trois lignes, trois barres.
  await expect(page.locator('[data-task-id]')).toHaveCount(3)

  await group.getByRole('button', { name: 'Replier' }).click()
  await expect(rows(page)).toHaveCount(1)
  // Le repli est un état PERSISTÉ, pas un pli d'affichage.
  await page.reload()
  await expect(rows(page)).toHaveCount(1)
  await rows(page).first().getByRole('button', { name: 'Déplier' }).click()
  await expect(rows(page)).toHaveCount(3)

  const gripB = rows(page).filter({ hasText: 'Enfant B' }).getByLabel('Réordonner')
  const rowA = rows(page).filter({ hasText: 'Enfant A' })
  const g = (await gripB.boundingBox())!
  const a = (await rowA.boundingBox())!
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + 40, a.y + a.height / 2, { steps: 6 })
  await page.mouse.up()
  await expect(rows(page)).toHaveText(titles('Phase 1', 'Enfant B', 'Enfant A'))

  await page.reload()
  await expect(rows(page)).toHaveText(titles('Phase 1', 'Enfant B', 'Enfant A'))
})

test('un lecteur n\'a ni poignée, ni bouton d\'ajout dans le groupe', async ({ page }) => {
  await loginAs(page, 'carol')
  await page.goto('/projects/c0000000-0000-0000-0000-000000000001')
  await expect(rows(page).first()).toBeVisible()

  await expect(page.getByLabel('Réordonner')).toHaveCount(0)
  // Le projet démo a bien un groupe (« Cadrage ») : l'absence du bouton n'est pas un faux positif.
  await expect(rows(page).filter({ hasText: 'Cadrage' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Ajouter une tâche au groupe' })).toHaveCount(0)
})
