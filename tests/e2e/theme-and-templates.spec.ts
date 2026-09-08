import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers'
import { TEMPLATES } from '../../lib/gantt/templates'

async function createProject(page: Page, name: string) {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
}

test('le thème sombre se choisit, survit au rechargement et à la navigation', async ({ page }) => {
  await loginAs(page, 'alice')
  const html = page.locator('html')

  // Sans choix enregistré, la page suit le système — le navigateur de test est en clair.
  await expect(html).toHaveAttribute('data-theme', 'light')

  await page.getByRole('button', { name: 'Passer au thème sombre' }).click()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: 'Passer au thème clair' })).toBeVisible()

  // Le fond a réellement changé : ce n'est pas seulement un attribut.
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).not.toBe('rgb(253, 246, 227)')

  // Rechargement complet : le script de démarrage relit le choix avant le premier rendu.
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'dark')

  // Une autre page, hors application : la bascule y est aussi et le choix tient.
  await page.getByRole('button', { name: 'Déconnexion' }).click()
  await page.waitForURL('**/login')
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Passer au thème clair' }).click()
  await expect(html).toHaveAttribute('data-theme', 'light')
})

test('un modèle remplit un projet vide de ses lignes et de ses liens', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Modèle ${Date.now()}`)

  const template = TEMPLATES.find((t) => t.id === 'lancement')!
  const expectedLinks = template.items.reduce((n, i) => n + (i.after?.length ?? 0), 0)

  const empty = page.getByTestId('gantt-empty')
  await expect(empty).toBeVisible()
  await empty.getByRole('button', { name: `Utiliser le modèle ${template.name}` }).click()

  // La carte d'accueil s'efface d'elle-même dès la première ligne, et les suivantes arrivent
  // une à une : on attend le compte final, pas un état intermédiaire.
  await expect(page.locator('[data-row-task-id]')).toHaveCount(template.items.length)
  await expect(page.locator('[data-dep-id]')).toHaveCount(expectedLinks)
  await expect(empty).toHaveCount(0)

  // Les enfants sont bien DANS leurs groupes : une ligne de groupe se replie avec les siens.
  for (const item of template.items) {
    await expect(page.locator('[data-row-task-id]', { hasText: item.title })).toHaveCount(1)
  }

  // Round-trip : tout vient de la base.
  await page.reload()
  await expect(page.locator('[data-row-task-id]')).toHaveCount(template.items.length)
  await expect(page.locator('[data-dep-id]')).toHaveCount(expectedLinks)
})
