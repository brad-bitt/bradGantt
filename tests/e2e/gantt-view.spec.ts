import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'
import { SIDEBAR_WIDTH } from '../../lib/gantt/geometry'

const DEMO = '/projects/c0000000-0000-0000-0000-000000000001'
// Second projet du seed, dont alice est aussi owner : il n'existe que pour prouver l'isolation.
const NEIGHBOUR = '/projects/c0000000-0000-0000-0000-000000000002'
const DEMO_TASK_ID = 'd0000000-0000-0000-0000-000000000002'
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
  // Contrôle POSITIF d'abord : sans lui, les deux assertions négatives qui suivent passeraient
  // à vide le jour où Next cesserait d'inliner le flight dans le HTML — et elles sont la SEULE
  // chose qui attrape une fuite de dépendances, le DOM étant rigoureusement identique.
  expect(html).toContain(DEMO_TASK_ID)
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

test('la timeline remplit la largeur visible aux trois zooms, sur deux gabarits', async ({ page }) => {
  await loginAs(page, 'alice')

  // On mesure le BLOC DE CONTENU, pas le `scrollWidth` du conteneur : ce dernier vaut au minimum
  // le `clientWidth`, donc il rapportait déjà « 1280 sur 1280 » quand le contenu ne faisait que
  // 584 px. C'est le piège classique de l'observable qui ne distingue pas les deux mondes.
  const measure = async () => {
    const scroller = page.getByTestId('gantt-scroll')
    const content = page.getByTestId('gantt-content')
    const clientWidth = await scroller.evaluate((el) => el.clientWidth)
    const contentWidth = (await content.boundingBox())!.width
    return { clientWidth, contentWidth }
  }

  for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size)
    await page.goto(DEMO)
    await expect(page.locator('[data-task-id]')).toHaveCount(4)

    for (const zoom of ['Jour', 'Semaine', 'Mois']) {
      await page.getByRole('button', { name: zoom, exact: true }).click()
      await expect(page.getByRole('button', { name: zoom, exact: true })).toHaveAttribute('aria-pressed', 'true')
      const { clientWidth, contentWidth } = await measure()
      // Mesuré avant correctif à 1280 : 1152 px en semaine et 584 px en mois pour 1280 visibles.
      expect(contentWidth, `${size.width}px / zoom ${zoom}`).toBeGreaterThanOrEqual(clientWidth)
      // Aujourd'hui reste atteignable à tous les zooms : c'est le recentrage de la tâche 9.
      await expect(page.getByTestId('today-line')).toBeInViewport()
    }
  }
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

  // Il ne doit pas non plus TOUCHER la grille : `mt-4` seul le collait à l'élément du dessous.
  const gap = await message.evaluate((el) => {
    const next = el.nextElementSibling!.getBoundingClientRect()
    return Math.round(next.top - el.getBoundingClientRect().bottom)
  })
  expect(gap).toBeGreaterThanOrEqual(16)

  // La propriété essentielle du message reste vraie : il suit le défilement horizontal. On pousse
  // le conteneur à fond à droite — la timeline remplit désormais l'écran à tous les zooms, donc il
  // y a réellement de quoi défiler et l'assertion n'est pas gratuite.
  await page.getByTestId('gantt-scroll').evaluate((el) => { el.scrollLeft = el.scrollWidth })
  await expect(message).toBeInViewport()
})
