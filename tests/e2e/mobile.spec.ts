import { test, expect, devices, type Page } from '@playwright/test'
import { loginAs, TICKETS_PROJECT } from './helpers'

/**
 * Un téléphone en portrait : écran étroit, pas de survol, pointeur grossier. `isMobile` fait
 * aussi passer le navigateur en émulation mobile, d'où `(hover: none)` pour les commandes
 * révélées au toucher.
 */
test.use({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } })

const DEMO = '/projects/c0000000-0000-0000-0000-000000000001'

async function createProject(page: Page, name: string) {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
}

/**
 * Nettoyage de fin de test, par l'UI : la carte est cherchée par son nom EXACT, propre au test
 * (`Date.now()`), si bien qu'on ne supprime jamais que le projet que ce test a créé. Un projet à
 * nom démesuré laissé en base ferait déborder la liste des runs suivants.
 */
async function deleteOwnProject(page: Page, name: string) {
  await page.goto('/projects')
  const card = page.getByRole('article', { name, exact: true })
  if ((await card.count()) === 0) return
  await expect(card).toHaveCount(1)
  page.once('dialog', (d) => {
    // Le message de confirmation cite le projet visé : on vérifie que c'est bien le nôtre.
    expect(d.message()).toContain(name)
    void d.accept()
  })
  await card.getByRole('button', { name: 'Actions du projet' }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await expect(card).toHaveCount(0)
}

test('la liste et la connexion tiennent dans la largeur du téléphone', async ({ page }) => {
  await page.goto('/login')
  // Aucun défilement horizontal du document : c'est la définition d'une page qui « tient ».
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await expect(page.getByRole('button', { name: /Passer au thème/ })).toBeVisible()

  await loginAs(page, 'alice')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await expect(page.getByRole('button', { name: 'Menu du compte' })).toBeInViewport()
  await expect(page.getByTestId('projects-summary')).toBeVisible()
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

test('l\'en-tête de projet passe sur deux rangées, même avec un nom de 100 caractères', async ({ page }) => {
  await loginAs(page, 'alice')
  // Review Focus 2 : le nom le plus long qu'accepte la validation.
  const name = `Projet au nom interminable ${Date.now()} `.padEnd(100, 'x')
  try {
    await createProject(page, name)

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    const header = page.getByRole('banner')
    await expect(header.getByRole('heading', { name })).toBeVisible()
    const tabs = header.getByRole('navigation', { name: 'Sections du projet' })
    await expect(tabs.getByRole('link', { name: 'Membres' })).toBeInViewport()
    await expect(header.getByRole('button', { name: 'Menu du compte' })).toBeInViewport()
    // Le fil d'Ariane se réduit au nom : le lien « Projets » est masqué, le signe en tient lieu.
    await expect(header.getByRole('link', { name: 'Projets', exact: true })).toBeHidden()

    // Deux rangées : les onglets passent SOUS le nom du projet.
    const title = (await header.getByRole('heading').boundingBox())!
    const tabsBox = (await tabs.boundingBox())!
    expect(tabsBox.y).toBeGreaterThanOrEqual(title.y + title.height)
  } finally {
    await deleteOwnProject(page, name)
  }
})

test('un nom de projet long et sans espace ne fait pas déborder la liste', async ({ page }) => {
  await loginAs(page, 'alice')
  // Sans espace, le navigateur n'a aucun point de coupure : la carte doit couper le mot.
  const name = `Projetsansespace${Date.now()}`.padEnd(100, 'x')
  try {
    await createProject(page, name)
    await page.goto('/projects')
    await expect(page.getByRole('article', { name, exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  } finally {
    await deleteOwnProject(page, name)
  }
})

test('les pages Tickets et Membres tiennent dans la largeur du téléphone', async ({ page }) => {
  await loginAs(page, 'alice')
  // Lecture seule : « Projet tickets » et la page Membres du démo ne font que s'afficher.
  for (const path of [
    `/projects/${TICKETS_PROJECT.id}/tickets`,
    `/projects/${TICKETS_PROJECT.id}/tickets?vue=liste`,
    `${DEMO}/membres`,
  ]) {
    await page.goto(path)
    await expect(page.getByRole('banner')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(390)
  }
  // Sur téléphone, les filtres sont derrière un bouton : les trois sélecteurs n'élargissent rien.
  await page.goto(`/projects/${TICKETS_PROJECT.id}/tickets`)
  await page.getByRole('button', { name: 'Filtres' }).click()
  await expect(page.getByRole('dialog', { name: 'Filtres' }).getByLabel('Statut')).toBeVisible()
})
