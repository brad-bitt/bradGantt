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

test('créer, renommer puis supprimer un projet', async ({ page }) => {
  await loginAs(page, 'alice')
  const name = `Projet ${Date.now()}`

  // Preuve du réamorçage de la liste après création. Elle ne peut PAS se faire en observant la
  // page : depuis que la création redirige vers le Gantt (tâche 9 du plan 2), Next 15 refait de
  // toute façon une requête serveur au retour sur `/projects`, par le lien comme par le bouton
  // Précédent — retirer `revalidatePath('/projects')` laisse donc la suite verte si l'on se
  // contente de regarder l'écran. On intercepte donc la réponse de la Server Action elle-même :
  // avec `revalidatePath`, Next y joint l'arbre « Mes projets » re-rendu, où figure le nom du
  // projet créé ; sans, la réponse ne porte que l'identifiant.
  let actionBody = ''
  await page.route('**/projects', async (route) => {
    const response = await route.fetch()
    const body = await response.text()
    if (route.request().method() === 'POST') actionBody = body
    await route.fulfill({ response, body })
  })

  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  // Depuis la tâche 9 du plan 2, la création emmène directement dans le Gantt du nouveau
  // projet. On vérifie la redirection, puis on revient à la liste pour la suite du parcours
  // (renommage et suppression, qui se pilotent depuis la carte).
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name })).toBeVisible()
  // C'est ICI que se joue la garantie : la réponse de l'action porte la liste re-rendue.
  expect(actionBody).toContain(name)
  // Retour par navigation client plutôt que par `page.goto` : on reste au plus près du parcours
  // réel. Ce retour ne prouve rien sur la réinvalidation (voir plus haut), il enchaîne le
  // parcours renommage/suppression, qui se pilote depuis la carte.
  await page.getByRole('link', { name: 'Projets', exact: true }).click()
  await page.waitForURL('**/projects')
  const card = page.getByRole('article', { name })
  await expect(card).toBeVisible()
  await expect(card.getByText('Propriétaire')).toBeVisible()

  await card.hover()
  await card.getByRole('button', { name: 'Actions du projet' }).click()
  await page.getByRole('menuitem', { name: 'Renommer' }).click()
  await page.getByLabel('Nom du projet').fill(`${name} v2`)
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  const renamed = page.getByRole('article', { name: `${name} v2` })
  await expect(renamed).toBeVisible()

  page.once('dialog', (d) => d.accept())
  await renamed.hover()
  await renamed.getByRole('button', { name: 'Actions du projet' }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await expect(renamed).toHaveCount(0)
})

test('un nom vide est refusé', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByRole('button', { name: 'Créer' }).click()
  // Scopé à la boîte de dialogue : Next.js monte en permanence son propre role="alert"
  // (AppRouterAnnouncer), donc un getByRole('alert') global matche 2 éléments.
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Le nom est requis')
})

test('la liste ouvre sur une ligne de synthèse et chaque carte porte sa vignette', async ({ page }) => {
  await loginAs(page, 'alice')

  // La ligne n'a de sens qu'avec au moins un projet : le compte de test en a toujours (seed).
  const summary = page.getByTestId('projects-summary')
  await expect(summary).toBeVisible()
  await expect(summary).toContainText(/\d+ projets?/)
  await expect(summary).toContainText('en retard')

  // Le projet démo du seed a des tâches : sa carte montre la vignette (barres en couleur), pas
  // le cadre « frise vide » d'un projet neuf.
  const demo = page.getByRole('article', { name: 'Projet démo' })
  await demo.scrollIntoViewIfNeeded()
  await expect(demo.getByRole('progressbar', { name: 'Avancement de Projet démo' })).toBeVisible()
  await expect(demo.getByText('Aucune tâche', { exact: true })).toHaveCount(0)
  await expect(demo.getByText('Kick-off dev')).toBeVisible()
})

test('le menu du nom de projet, dans l\'en-tête : renommer, basculer les tickets, supprimer', async ({ page }) => {
  await loginAs(page, 'alice')
  const name = `Entête ${Date.now()}`
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)

  const header = page.getByRole('banner')
  const actions = header.getByRole('button', { name: 'Actions du projet' })

  // Renommer depuis le Gantt : l'en-tête suit sans rechargement (revalidation du layout).
  await actions.click()
  await page.getByRole('menuitem', { name: 'Renommer' }).click()
  await page.getByLabel('Nom du projet').fill(`${name} v2`)
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(header.getByRole('heading', { name: `${name} v2` })).toBeVisible()

  // Review Focus 4 : désactiver les tickets DEPUIS la page Tickets bascule la page d'elle-même.
  await header.getByRole('link', { name: 'Tickets', exact: true }).click()
  await page.waitForURL('**/tickets')
  await page.getByRole('button', { name: 'Activer les tickets' }).click()
  await expect(page.getByRole('region', { name: 'À faire' })).toBeVisible()
  await actions.click()
  await page.getByRole('menuitem', { name: 'Désactiver les tickets' }).click()
  await expect(page.getByRole('button', { name: 'Activer les tickets' })).toBeVisible()

  // Review Focus 3 : supprimer depuis l'en-tête ramène à la liste, sans passer par une 404.
  page.once('dialog', (d) => d.accept())
  await actions.click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await page.waitForURL(/\/projects$/)
  await expect(page.getByRole('heading', { name: 'Mes projets' })).toBeVisible()
  await expect(page.getByRole('article', { name: `${name} v2` })).toHaveCount(0)
})

test('« N en retard » ne garde que les projets en retard, « Tout afficher » rend la liste', async ({ page }) => {
  await loginAs(page, 'alice')
  const stamp = Date.now()
  const calm = `Calme ${stamp}`
  const late = `Retard ${stamp}`

  // Un projet vide n'est jamais en retard ; l'autre reçoit une tâche finie il y a cinq jours.
  await createProject(page, calm)
  await createProject(page, late)
  await page.getByRole('button', { name: '+ Tâche' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await dialog.getByLabel('Titre').fill('En souffrance')
  await dialog.getByLabel('Début').fill(isoInDays(-10))
  await dialog.getByLabel('Fin').fill(isoInDays(-5))
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click()
  await expect(page.locator('[data-row-task-id]', { hasText: 'En souffrance' })).toHaveCount(1)

  await page.goto('/projects')
  await page.getByTestId('projects-summary').getByRole('link', { name: /en retard$/ }).click()
  await page.waitForURL('**/projects?filtre=retard')
  await expect(page.getByRole('article', { name: late })).toBeVisible()
  await expect(page.getByRole('article', { name: calm })).toHaveCount(0)

  await page.getByRole('link', { name: 'Tout afficher' }).click()
  await page.waitForURL(/\/projects$/)
  await expect(page.getByRole('article', { name: calm })).toBeVisible()
})

test('toute la carte ouvre le Gantt, mais son menu ⋯ n\'y emmène pas', async ({ page }) => {
  await loginAs(page, 'alice')
  const stamp = Date.now()
  const empty = `Carte vide ${stamp}`
  const filled = `Carte pleine ${stamp}`
  await createProject(page, empty)
  await createProject(page, filled)
  await page.getByRole('button', { name: '+ Tâche' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await dialog.getByLabel('Titre').fill('Une tâche')
  await dialog.getByLabel('Début').fill(isoInDays(1))
  await dialog.getByLabel('Fin').fill(isoInDays(5))
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click()
  await expect(page.locator('[data-row-task-id]', { hasText: 'Une tâche' })).toHaveCount(1)

  await page.goto('/projects')
  const card = page.getByRole('article', { name: empty })

  // Le menu est posé au-dessus du lien de la carte : l'ouvrir ne navigue pas.
  await card.hover()
  await card.getByRole('button', { name: 'Actions du projet' }).click()
  await expect(page.getByRole('menu', { name: 'Actions du projet' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/projects$/)

  // Carte vide : un clic au milieu, loin du titre, ouvre le projet.
  const box = (await card.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)

  // Carte NON vide : vignette et barre d'avancement sont `relative` et plus loin dans le DOM que
  // le lien ; sans `after:z-[1]` elles intercepteraient le clic. Clics réels à la souris, pas
  // `locator.click()` qui refuserait d'agir sur un élément recouvert.
  for (const target of ['thumbnail', 'progress'] as const) {
    await page.goto('/projects')
    const full = page.getByRole('article', { name: filled })
    const el = target === 'thumbnail'
      ? full.locator('div[aria-hidden].relative.overflow-hidden')
      : full.getByRole('progressbar')
    await el.scrollIntoViewIfNeeded()
    const b = (await el.boundingBox())!
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
  }
})
