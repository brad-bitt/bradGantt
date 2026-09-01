import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers'
import { SIDEBAR_WIDTH } from '../../lib/gantt/geometry'

/** Date locale au format ISO, décalée de `n` jours — même convention que `todayISO()` côté serveur. */
function isoInDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Chaque test travaille sur un projet NEUF qu'il crée lui-même. Le projet démo du seed est
 * partagé par les autres suites et le second projet du seed n'est pas vide : créer ici est le
 * seul moyen d'avoir un projet réellement vierge sans toucher au seed.
 */
async function createProject(page: Page, name: string) {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
}

test('créer, éditer puis supprimer une tâche', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Édition ${Date.now()}`)

  await page.getByRole('button', { name: '+ Tâche' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await dialog.getByLabel('Titre').fill('Maquettes')
  await dialog.getByLabel('Début').fill(isoInDays(0))
  await dialog.getByLabel('Fin').fill(isoInDays(4))
  await dialog.getByRole('button', { name: 'Créer' }).click()

  const bar = page.locator('[data-task-id]', { hasText: 'Maquettes' })
  await expect(bar).toHaveCount(1)
  // `toBeVisible` ne prouve rien sur un écran qui défile horizontalement (Playwright tient une
  // boîte non nulle pour visible, même hors champ). La tâche créée doit atterrir DANS le champ
  // de vision, sinon l'utilisateur croit que rien ne s'est passé.
  await expect(bar).toBeInViewport()
  const box = (await bar.boundingBox())!
  expect(box.x + box.width).toBeGreaterThan(SIDEBAR_WIDTH) // et pas cachée sous la sidebar collante

  // Rechargement : la création a réellement été persistée, ce n'est pas seulement l'état optimiste.
  await page.reload()
  await expect(page.locator('[data-task-id]', { hasText: 'Maquettes' })).toHaveCount(1)

  await bar.dblclick()
  const edit = page.getByRole('dialog', { name: 'Modifier la tâche' })
  await edit.getByLabel('Titre').fill('Maquettes v2')
  await edit.getByLabel('Avancement').fill('40')
  await edit.getByRole('button', { name: 'Enregistrer' }).click()

  const renamed = page.locator('[data-task-id]', { hasText: 'Maquettes v2' })
  await expect(renamed).toHaveCount(1)
  await expect(page.locator('[data-row-task-id]', { hasText: 'Maquettes v2' })).toHaveCount(1)

  // Round-trip complet : après rechargement, l'avancement modifié revient bien de la base.
  await page.reload()
  await page.locator('[data-task-id]', { hasText: 'Maquettes v2' }).dblclick()
  await expect(page.getByRole('dialog').getByLabel('Avancement')).toHaveValue('40')

  page.once('dialog', (d) => d.accept())
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.locator('[data-task-id]')).toHaveCount(0)

  // Supprimer sa dernière tâche ne doit pas laisser une grille rigoureusement nue : le message
  // de projet vide (posé en `sticky left-4` en tâche 9) doit rester dans le champ de vision.
  const empty = page.getByText('Aucune tâche pour l\'instant.')
  await expect(empty).toBeVisible()
  await expect(empty).toBeInViewport()

  await page.reload()
  await expect(page.locator('[data-task-id]')).toHaveCount(0)
})

test('un titre vide est refusé inline, sans toast ; le jalon créé ensuite tient sur un jour', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Validation ${Date.now()}`)

  await page.getByRole('button', { name: '+ Jalon' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouveau jalon' })
  await dialog.getByRole('button', { name: 'Créer' }).click()

  // Politique d'erreur du projet : validation → inline, persistance → toast. Rien ne doit
  // partir en base, donc aucun toast ne doit apparaître.
  // Portée à la modale : Next pose son propre `role="alert"` (annonceur de route) dans la page.
  await expect(dialog.getByRole('alert')).toHaveText('Le titre est requis')
  await expect(page.locator('[data-task-id]')).toHaveCount(0)
  await expect(page.getByText('Modification non enregistrée')).toHaveCount(0)

  // Le formulaire reste ouvert : on corrige et on crée. Le jalon part avec `end_date = start_date`,
  // sans quoi la contrainte `tasks_milestone_single_day` le rejetterait (toast, pas de barre).
  await dialog.getByLabel('Titre').fill('Kick-off')
  await dialog.getByRole('button', { name: 'Créer' }).click()
  await expect(page.locator('[data-task-id]')).toHaveCount(1)
  await expect(page.getByText('Modification non enregistrée')).toHaveCount(0)

  await page.reload()
  await expect(page.locator('[data-row-task-id]', { hasText: 'Kick-off' })).toHaveCount(1)
})

test('un lecteur ne peut pas ouvrir l\'éditeur', async ({ page }) => {
  await loginAs(page, 'carol')
  await page.goto('/projects/c0000000-0000-0000-0000-000000000001')
  await expect(page.locator('[data-task-id]')).toHaveCount(4)
  await expect(page.getByRole('button', { name: '+ Tâche' })).toHaveCount(0)

  await page.locator('[data-task-id]').first().dblclick()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.locator('[data-row-task-id]').first().dblclick()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('un groupe s\'édite depuis la sidebar et sa suppression emporte ses tâches', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Groupes ${Date.now()}`)

  // Création au clavier : « Entrée » dans le champ Titre doit soumettre. Le bouton « Créer »
  // vit dans le pied de la modale, hors du <form> — il n'est rattaché que par l'attribut
  // `form`, sans lequel la soumission implicite ne marche pas (un formulaire à plusieurs
  // champs et sans bouton de soumission n'est pas soumis par Entrée).
  await page.getByRole('button', { name: '+ Groupe' }).click()
  const creation = page.getByRole('dialog', { name: 'Nouveau groupe' })
  await creation.getByLabel('Titre').fill('Phase 1')
  await creation.getByLabel('Titre').press('Enter')
  await expect(page.locator('[data-row-task-id]', { hasText: 'Phase 1' })).toHaveCount(1)

  await page.getByRole('button', { name: '+ Tâche' }).click()
  const nouvelle = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await nouvelle.getByLabel('Titre').fill('Atelier')
  await nouvelle.getByLabel('Groupe').selectOption({ label: 'Phase 1' })
  await nouvelle.getByRole('button', { name: 'Créer' }).click()
  await expect(page.locator('[data-row-task-id]')).toHaveCount(2)

  // Seconde porte d'entrée de l'éditeur : la ligne de sidebar (la première est la barre).
  await page.locator('[data-row-task-id]', { hasText: 'Phase 1' }).dblclick()
  const edition = page.getByRole('dialog', { name: 'Modifier le groupe' })
  await expect(edition).toBeVisible()
  await expect(edition.getByLabel('Type')).toHaveCount(0) // un groupe ne change pas de type
  await expect(edition.getByLabel('Fin')).toHaveCount(0) // ses bornes viennent de ses enfants

  let confirmation = ''
  page.once('dialog', (d) => { confirmation = d.message(); void d.accept() })
  await edition.getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.locator('[data-row-task-id]')).toHaveCount(0)
  expect(confirmation).toContain('et toutes ses tâches')

  // La cascade a bien emporté la tâche enfant en base, pas seulement à l'écran.
  await page.reload()
  await expect(page.locator('[data-row-task-id]')).toHaveCount(0)
})

test('la modale reste utilisable sur une fenêtre courte', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 })
  await loginAs(page, 'alice')
  await createProject(page, `Fenêtre courte ${Date.now()}`)

  await page.getByRole('button', { name: '+ Tâche' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  // L'éditeur de tâche mesure 744 px de haut. Sans en-tête et pied ancrés au-dessus d'un
  // contenu défilant, il débordait d'une fenêtre de 600 px DES DEUX CÔTÉS à la fois : l'overlay
  // est en `fixed`, la page ne défile donc pas, et ni le titre (mesuré à y = -54) ni « Créer »
  // (y = 611 pour 600 px de haut) n'étaient atteignables — formulaire impossible à valider.
  await expect(dialog.getByRole('heading', { name: 'Nouvelle tâche' })).toBeInViewport({ ratio: 1 })
  await expect(dialog.getByRole('button', { name: 'Fermer' })).toBeInViewport({ ratio: 1 })
  await expect(dialog.getByRole('button', { name: 'Créer' })).toBeInViewport({ ratio: 1 })
  await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeInViewport({ ratio: 1 })

  // Et le formulaire reste réellement utilisable : le champ Titre s'atteint par le défilement
  // interne du contenu, et la création aboutit.
  await dialog.getByLabel('Titre').fill('Sur petite fenêtre')
  await dialog.getByRole('button', { name: 'Créer' }).click()
  await expect(page.locator('[data-task-id]')).toHaveCount(1)
})
