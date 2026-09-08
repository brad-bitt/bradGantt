import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers'

/** Date locale au format ISO, décalée de `n` jours — même convention que `todayISO()` côté serveur. */
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

/** Titres des lignes de la sidebar, dans l'ordre où elles s'affichent. */
async function rowTitles(page: Page): Promise<string[]> {
  return page.locator('[data-row-task-id] span.flex-1').allInnerTexts()
}

test('enchaîner une tâche après une autre : rang, dates et lien', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Enchaînement ${Date.now()}`)

  await createTask(page, 'Cadrage', isoInDays(0), isoInDays(3))
  await createTask(page, 'Recette', isoInDays(10), isoInDays(12))
  expect(await rowTitles(page)).toEqual(['Cadrage', 'Recette'])

  // Le bouton n'existe qu'au survol par l'OPACITÉ, jamais par un rendu conditionnel : il est
  // donc bien présent dans le document et cliquable sans survol préalable.
  await page.locator('[data-row-task-id]', { hasText: 'Cadrage' })
    .getByRole('button', { name: 'Ajouter après « Cadrage »' })
    .click()

  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  // Le début est pré-rempli au LENDEMAIN de la fin de l'ancre : c'est tout le sens de « après ».
  await expect(dialog.getByLabel('Début')).toHaveValue(isoInDays(4))
  await expect(dialog.getByLabel('Lier à la tâche précédente')).toBeChecked()
  await dialog.getByLabel('Titre').fill('Développement')
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click()

  // Insérée ENTRE les deux, et non ajoutée en fin de liste.
  await expect(page.locator('[data-row-task-id]')).toHaveCount(3)
  expect(await rowTitles(page)).toEqual(['Cadrage', 'Développement', 'Recette'])

  // Une flèche de dépendance a bien été tracée.
  await expect(page.locator('[data-dep-id]')).toHaveCount(1)

  // Round-trip : l'ordre et le lien viennent de la base, pas seulement de l'état optimiste.
  await page.reload()
  expect(await rowTitles(page)).toEqual(['Cadrage', 'Développement', 'Recette'])
  await expect(page.locator('[data-dep-id]')).toHaveCount(1)
})

test('enchaîner sans lier quand la case est décochée', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Sans lien ${Date.now()}`)

  await createTask(page, 'Cadrage', isoInDays(0), isoInDays(3))
  await page.locator('[data-row-task-id]', { hasText: 'Cadrage' })
    .getByRole('button', { name: 'Ajouter après « Cadrage »' })
    .click()

  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await dialog.getByLabel('Titre').fill('Indépendante')
  await dialog.getByLabel('Lier à la tâche précédente').uncheck()
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click()

  await expect(page.locator('[data-row-task-id]')).toHaveCount(2)
  await expect(page.locator('[data-dep-id]')).toHaveCount(0)
})

test('enchaîner un groupe après un groupe', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Phases ${Date.now()}`)

  await page.getByRole('button', { name: '+ Groupe' }).click()
  const first = page.getByRole('dialog', { name: 'Nouveau groupe' })
  await first.getByLabel('Titre').fill('Phase 1')
  await first.getByRole('button', { name: 'Créer', exact: true }).click()
  await expect(page.locator('[data-row-task-id]', { hasText: 'Phase 1' })).toHaveCount(1)

  await page.locator('[data-row-task-id]', { hasText: 'Phase 1' })
    .getByRole('button', { name: 'Ajouter après « Phase 1 »' })
    .click()

  // Un groupe engendre un GROUPE : le bouton « + » voisin couvre déjà l'ajout d'une tâche
  // DANS le groupe, et la case de liaison n'a pas de sens pour un contenant.
  const second = page.getByRole('dialog', { name: 'Nouveau groupe' })
  await expect(second.getByLabel('Lier à la tâche précédente')).toHaveCount(0)
  await second.getByLabel('Titre').fill('Phase 2')
  await second.getByRole('button', { name: 'Créer', exact: true }).click()

  // Comparaison en capitales : une ligne de groupe est rendue en `uppercase` par la feuille de
  // style, `innerText` restitue donc le texte tel qu'il est PEINT et non tel qu'il est stocké.
  expect((await rowTitles(page)).map((t) => t.toUpperCase())).toEqual(['PHASE 1', 'PHASE 2'])
})

test('un projet vide accueille avec des points de départ, un lecteur seulement avec un constat', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Accueil ${Date.now()}`)

  const empty = page.getByTestId('gantt-empty')
  await expect(empty).toBeVisible()
  // La carte flotte AU-DESSUS de la grille : elle ne doit pas repousser la sidebar vers le bas.
  const sidebar = page.getByTestId('gantt-sidebar')
  const sidebarBox = (await sidebar.boundingBox())!
  const emptyBox = (await empty.boundingBox())!
  expect(sidebarBox.y).toBeLessThanOrEqual(emptyBox.y)

  await empty.getByRole('button', { name: 'Premier jalon' }).click()
  await expect(page.getByRole('dialog', { name: 'Nouveau jalon' })).toBeVisible()
})

test('la barre de synthèse compte ce que le projet contient', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Synthèse ${Date.now()}`)

  // Aucune tâche : rien à résumer, la barre ne s'affiche pas.
  await expect(page.getByTestId('gantt-summary')).toHaveCount(0)

  await createTask(page, 'Cadrage', isoInDays(0), isoInDays(3))
  const summary = page.getByTestId('gantt-summary')
  await expect(summary).toBeVisible()
  await expect(summary).toContainText('Tâches')
  await expect(summary.getByRole('progressbar', { name: 'Avancement du projet' })).toHaveAttribute('aria-valuenow', '0')

  await page.locator('[data-task-id]', { hasText: 'Cadrage' }).dblclick()
  const edit = page.getByRole('dialog', { name: 'Modifier la tâche' })
  await edit.getByLabel('Avancement').fill('50')
  await edit.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(summary.getByRole('progressbar', { name: 'Avancement du projet' })).toHaveAttribute('aria-valuenow', '50')
})
