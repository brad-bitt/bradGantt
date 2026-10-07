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

/** Supprime un projet jetable depuis sa carte, s'il existe encore : nettoyage de fin de test. */
async function deleteFromCard(page: Page, name: string) {
  await page.goto('/projects')
  const card = page.getByRole('article', { name, exact: true })
  if ((await card.count()) === 0) return
  page.once('dialog', (d) => d.accept())
  await card.hover()
  await card.getByRole('button', { name: 'Actions du projet' }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await expect(card).toHaveCount(0)
}

test('la fenêtre « Renommer » d\'une carte passe au-dessus des cartes suivantes', async ({ page }) => {
  // Deux projets créés puis supprimés par l'interface : plus long que les 30 s par défaut.
  test.setTimeout(90_000)
  await loginAs(page, 'alice')
  const stamp = Date.now()
  const second = `Dessous ${stamp}`
  const first = `Dessus ${stamp}`
  try {
    // La liste est triée du plus récent au plus ancien : `first` est la première carte, `second`
    // la suivante, dans la même rangée.
    await createProject(page, second)
    await createProject(page, first)
    await page.goto('/projects')
    const cards = page.getByRole('article')
    await expect(cards.nth(0)).toHaveAccessibleName(first)
    await expect(cards.nth(1)).toHaveAccessibleName(second)

    // La fenêtre est centrée dans l'écran : on règle la hauteur pour que le « ⋯ » de la carte
    // SUIVANTE tombe à mi-hauteur, donc sous le panneau. Rendue en place, la fenêtre passait
    // sous ce bouton (`relative z-10` d'une carte plus loin dans le DOM), qui recevait le clic.
    const nextActions = cards.nth(1).getByRole('button', { name: 'Actions du projet' })
    const target = (await nextActions.boundingBox())!
    const y = target.y + target.height / 2
    await page.setViewportSize({ width: 1280, height: Math.max(360, Math.round(2 * y)) })

    await cards.nth(0).hover()
    await cards.nth(0).getByRole('button', { name: 'Actions du projet' }).click()
    await page.getByRole('menuitem', { name: 'Renommer' }).click()
    const dialog = page.getByRole('dialog', { name: 'Renommer le projet' })
    await expect(dialog).toBeVisible()

    const at = (await nextActions.boundingBox())!
    const x = at.x + at.width / 2
    const cy = at.y + at.height / 2
    const panel = (await dialog.boundingBox())!
    // Garde du test lui-même : le point visé est bien DANS le panneau.
    expect(x).toBeGreaterThan(panel.x)
    expect(x).toBeLessThan(panel.x + panel.width)
    expect(cy).toBeGreaterThan(panel.y)
    expect(cy).toBeLessThan(panel.y + panel.height)
    expect(await page.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px, py)
      return !!el && !!el.closest('[role="dialog"]')
    }, [x, cy])).toBe(true)

    await page.mouse.click(x, cy)
    // Sans effet parasite : ni menu de l'autre projet, ni navigation, la fenêtre reste ouverte.
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(page).toHaveURL(/\/projects$/)
    await expect(dialog).toBeVisible()

    // Et elle fonctionne toujours.
    await dialog.getByLabel('Nom du projet').fill(`${first} v2`)
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('article', { name: `${first} v2` })).toBeVisible()
  } finally {
    await page.setViewportSize({ width: 1280, height: 720 })
    // Renommé si le test est allé au bout, sous son nom d'origine sinon.
    await deleteFromCard(page, `${first} v2`)
    await deleteFromCard(page, first)
    await deleteFromCard(page, second)
  }
})

test('ouverte depuis l\'en-tête en thème clair, la fenêtre « Renommer » garde son encre', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => { try { localStorage.setItem('bradgantt.theme', 'light') } catch {} })
  await loginAs(page, 'alice')
  const name = `Encre ${Date.now()}`
  try {
    await createProject(page, name)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    const header = page.getByRole('banner')
    await header.getByRole('button', { name: 'Actions du projet' }).click()
    await page.getByRole('menuitem', { name: 'Renommer' }).click()
    const dialog = page.getByRole('dialog', { name: 'Renommer le projet' })
    await expect(dialog).toBeVisible()
    // Hors du `banner` : rendue dans l'en-tête, elle en héritait l'encre crème.
    await expect(header.getByRole('dialog')).toHaveCount(0)
    const headerColor = await header.getByRole('heading', { name }).evaluate((el) => getComputedStyle(el).color)
    const titleColor = await dialog.getByRole('heading', { name: 'Renommer le projet' }).evaluate((el) => getComputedStyle(el).color)
    expect(titleColor).not.toBe(headerColor)
    await page.keyboard.press('Escape')
  } finally {
    await deleteFromCard(page, name)
  }
})
