import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'
import { SIDEBAR_WIDTH } from '../../lib/gantt/geometry'

const DEMO = '/projects/c0000000-0000-0000-0000-000000000001'
// Second projet du seed, dont alice est aussi owner : il n'existe que pour prouver l'isolation.
const NEIGHBOUR = '/projects/c0000000-0000-0000-0000-000000000002'
const NEIGHBOUR_TASK_ID = 'd0000000-0000-0000-0000-0000000000f1'
const NEIGHBOUR_DEP_ID = 'e0000000-0000-0000-0000-0000000000f1'

test('le projet démo affiche ses lignes, barres, jalon et flèches', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto(DEMO)
  await expect(page.getByRole('heading', { name: 'Projet démo' })).toBeVisible()
  for (const name of ['Cadrage', 'Ateliers', 'Spécifications', 'Kick-off dev']) {
    await expect(page.locator('[data-row-task-id]', { hasText: name })).toBeVisible()
  }
  await expect(page.locator('[data-task-id]')).toHaveCount(4)
  await expect(page.locator('svg [data-dep-id]')).toHaveCount(2)
  await expect(page.getByTestId('today-line')).toBeVisible()
})

// Verrou d'ISOLATION INTER-PROJETS. Les `.eq('project_id', id)` de app/(app)/projects/[id]/page.tsx
// sont le seul rempart : la RLS autorise la lecture de TOUTES les lignes des projets dont on est
// membre, elle ne filtre pas sur le projet demandé. Ce test est la seule chose qui tienne cette
// ligne, dans un fichier que les tâches 10 à 14 vont toutes toucher.
test('aucune donnée du projet voisin ne fuit dans le projet démo', async ({ page }) => {
  await loginAs(page, 'alice')

  // 1. La fixture existe vraiment et alice y a accès : sans cette moitié, le test passerait
  //    tout aussi bien si le second projet du seed n'était jamais créé.
  await page.goto(NEIGHBOUR)
  await expect(page.getByRole('heading', { name: 'Projet voisin' })).toBeVisible()
  await expect(page.locator('[data-row-task-id]', { hasText: 'FUITE INTER-PROJETS' }).first()).toBeVisible()
  await expect(page.locator('[data-task-id]')).toHaveCount(2)

  // 2. La page du démo n'affiche QUE ses 4 tâches et ses 2 dépendances.
  await page.goto(DEMO)
  await expect(page.locator('[data-row-task-id]')).toHaveCount(4)
  await expect(page.locator('[data-task-id]')).toHaveCount(4)
  await expect(page.locator('svg [data-dep-id]')).toHaveCount(2)
  await expect(page.getByText('FUITE INTER-PROJETS')).toHaveCount(0)

  // 3. Rien ne fuit non plus dans le payload envoyé au navigateur. Nécessaire : une dépendance
  //    d'un autre projet dont les deux tâches sont absentes ne trace aucune flèche — invisible
  //    dans le DOM, mais bel et bien transmise. Le payload RSC est sérialisé dans la page.
  const html = await page.content()
  expect(html).not.toContain(NEIGHBOUR_TASK_ID)
  expect(html).not.toContain(NEIGHBOUR_DEP_ID)
})

test('la vue s\'ouvre recentrée sur aujourd\'hui, pas sur une grille vide', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto(DEMO)
  await expect(page.locator('[data-task-id]')).toHaveCount(4)

  const width = page.viewportSize()!.width
  const scrollLeft = await page.getByTestId('gantt-scroll').evaluate((el) => el.scrollLeft)
  expect(scrollLeft).toBeGreaterThan(0)

  // La sidebar collante masque les SIDEBAR_WIDTH premiers pixels : une barre n'est réellement
  // visible que si elle déborde à droite de la sidebar et commence avant le bord droit.
  const boxes = await page.locator('[data-task-id]').evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right })),
  )
  const visible = boxes.filter((b) => b.right > SIDEBAR_WIDTH && b.left < width)
  expect(visible.length).toBeGreaterThan(0)

  // Et « aujourd'hui » est bien dans la partie visible, sans être collé au bord de la sidebar.
  const line = (await page.getByTestId('today-line').boundingBox())!
  expect(line.x).toBeGreaterThan(SIDEBAR_WIDTH)
  expect(line.x).toBeLessThan(width)
})

test('le corps du Gantt remplit la hauteur disponible', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto(DEMO)
  await expect(page.locator('[data-task-id]')).toHaveCount(4)

  // 4 lignes n'occupent que ~230 px : sans étirement, la grille et le bord droit de la sidebar
  // s'interrompaient en plein écran, laissant le fond crème nu en dessous.
  const scroller = (await page.getByTestId('gantt-scroll').boundingBox())!
  const sidebar = (await page.getByTestId('gantt-sidebar').boundingBox())!
  expect(sidebar.height).toBeGreaterThan(4 * 44 + 100) // au-delà de la hauteur de ses 4 lignes
  expect(sidebar.height).toBeGreaterThan(scroller.height * 0.8) // et jusqu'au bas du conteneur
})

test('le zoom change la largeur de la timeline', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto(DEMO)
  const bar = page.locator('[data-task-id="d0000000-0000-0000-0000-000000000002"]')
  const dayWidth = (await bar.boundingBox())!.width
  await page.getByRole('button', { name: 'Mois' }).click()
  const monthWidth = (await bar.boundingBox())!.width
  expect(monthWidth).toBeLessThan(dayWidth / 5)
})

test('un non-membre obtient une 404', async ({ page }) => {
  await loginAs(page, 'dave')
  const res = await page.goto(DEMO)
  expect(res?.status()).toBe(404)
})

test('un projet sans tâche affiche son message, dans le champ de vision', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(`Projet vide ${Date.now()}`)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)

  // `toBeVisible` ne suffit pas : Playwright le tient pour vrai dès que la boîte est non nulle,
  // même à x = -639. Le message était posé en `absolute` dans la timeline défilée, donc le
  // recentrage sur aujourd'hui le sortait de l'écran — un projet neuf s'ouvrait sur une grille
  // nue, sans la moindre indication. C'est bien la présence DANS LE CHAMP DE VISION qu'on exige.
  const message = page.getByText('Aucune tâche pour l\'instant.')
  await expect(message).toBeVisible()
  await expect(message).toBeInViewport()
})
