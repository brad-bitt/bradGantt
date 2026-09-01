import { test, expect, type Locator, type Page } from '@playwright/test'
import { loginAs } from './helpers'
import { DRAG_THRESHOLD_PX, PX_PER_DAY, RESIZE_HANDLE_PX } from '../../lib/gantt/geometry'

/** Date locale au format ISO, décalée de `n` jours — même convention que `todayISO()` côté serveur. */
function isoInDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Dates RELATIVES à aujourd'hui et non figées dans le fichier : la plage affichée est calculée
 * autour du jour courant (`computeRange`), et la vue est recentrée dessus au chargement. Des
 * dates en dur sortiraient du champ de vision au bout de quelques semaines et le glissement
 * viserait le vide.
 */
const START = 6
const END = 8

async function projectWithTask(page: Page, kind: 'task' | 'milestone' = 'task'): Promise<Locator> {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(`Drag ${Date.now()}`)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)

  await page.getByRole('button', { name: kind === 'task' ? '+ Tâche' : '+ Jalon' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Titre').fill('Dev')
  await d.getByLabel('Début').fill(isoInDays(START))
  if (kind === 'task') await d.getByLabel('Fin').fill(isoInDays(END))
  await d.getByRole('button', { name: 'Créer' }).click()

  const bar = page.locator('[data-task-id]', { hasText: 'Dev' })
  await expect(bar).toHaveCount(1)
  // Sur un écran qui défile horizontalement, `toBeVisible` ne prouve rien (Playwright tient une
  // boîte non nulle pour visible, même à x négatif) : c'est le champ de vision qui compte, sans
  // quoi les coordonnées de souris calculées plus bas viseraient hors écran.
  await expect(bar).toBeInViewport()
  return bar
}

/** Glissement au pointeur, en deux paliers pour produire de vrais `pointermove` intermédiaires. */
async function dragBy(page: Page, x: number, y: number, dx: number) {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx / 2, y, { steps: 4 })
  await page.mouse.move(x + dx, y, { steps: 4 })
  await page.mouse.up()
}

async function dragCenter(page: Page, bar: Locator, dx: number) {
  const box = (await bar.boundingBox())!
  await dragBy(page, box.x + box.width / 2, box.y + box.height / 2, dx)
}

const title = (start: number, end: number) => `Dev — ${isoInDays(start)} → ${isoInDays(end)}`

test('déplacer une barre conserve sa durée et la nouvelle position est persistée', async ({ page }) => {
  await loginAs(page, 'alice')
  const bar = await projectWithTask(page)
  await expect(bar).toHaveAttribute('title', title(START, END))

  await dragCenter(page, bar, 2 * PX_PER_DAY.day)
  await expect(bar).toHaveAttribute('title', title(START + 2, END + 2))

  // Vers la gauche aussi : `pxToDays` est symétrique sur la demi-colonne (correctif de la tâche 2).
  await dragCenter(page, bar, -1 * PX_PER_DAY.day)
  await expect(bar).toHaveAttribute('title', title(START + 1, END + 1))

  // L'état optimiste ne prouve rien : seul le rechargement dit ce qui est en base.
  await page.reload()
  await expect(page.locator('[data-task-id]', { hasText: 'Dev' })).toHaveAttribute('title', title(START + 1, END + 1))
})

test('un jalon se déplace aussi, et reste sur un seul jour', async ({ page }) => {
  await loginAs(page, 'alice')
  const bar = await projectWithTask(page, 'milestone')
  await expect(bar).toHaveAttribute('title', `Dev — ${isoInDays(START)}`)

  await dragCenter(page, bar, 3 * PX_PER_DAY.day)
  await expect(bar).toHaveAttribute('title', `Dev — ${isoInDays(START + 3)}`)

  await page.reload()
  await expect(page.locator('[data-task-id]', { hasText: 'Dev' })).toHaveAttribute('title', `Dev — ${isoInDays(START + 3)}`)
})

test('redimensionner par le bord droit puis par le bord gauche', async ({ page }) => {
  await loginAs(page, 'alice')
  const bar = await projectWithTask(page)

  let box = (await bar.boundingBox())!
  await dragBy(page, box.x + box.width - RESIZE_HANDLE_PX / 2, box.y + box.height / 2, PX_PER_DAY.day)
  await expect(bar).toHaveAttribute('title', title(START, END + 1))

  box = (await bar.boundingBox())!
  await dragBy(page, box.x + RESIZE_HANDLE_PX / 2, box.y + box.height / 2, PX_PER_DAY.day)
  await expect(bar).toHaveAttribute('title', title(START + 1, END + 1))

  // La barre a bien changé de largeur puis retrouvé la sienne : le redimensionnement n'est pas
  // un déplacement déguisé.
  const width = (await bar.boundingBox())!.width
  expect(Math.round(width / PX_PER_DAY.day)).toBe(END - START + 1)

  await page.reload()
  await expect(page.locator('[data-task-id]', { hasText: 'Dev' })).toHaveAttribute('title', title(START + 1, END + 1))
})

test('un redimensionnement ne fait pas descendre la barre sous un jour', async ({ page }) => {
  await loginAs(page, 'alice')
  const bar = await projectWithTask(page)

  const box = (await bar.boundingBox())!
  await dragBy(page, box.x + box.width - RESIZE_HANDLE_PX / 2, box.y + box.height / 2, -400)
  await expect(bar).toHaveAttribute('title', title(START, START))
  expect(Math.round((await bar.boundingBox())!.width / PX_PER_DAY.day)).toBe(1)

  await page.reload()
  await expect(page.locator('[data-task-id]', { hasText: 'Dev' })).toHaveAttribute('title', title(START, START))
})

test('un double-clic ouvre toujours l\'éditeur et n\'écrit aucun déplacement', async ({ page }) => {
  await loginAs(page, 'alice')
  const bar = await projectWithTask(page)

  // Un double-clic, c'est deux `pointerdown`/`pointerup` à delta nul : le glisser-déposer ne
  // doit ni écrire, ni empêcher l'ouverture de l'éditeur (tâche 10).
  await bar.dblclick()
  await expect(page.getByRole('dialog', { name: 'Modifier la tâche' })).toBeVisible()
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(bar).toHaveAttribute('title', title(START, END))
  await expect(page.getByText('Modification non enregistrée')).toHaveCount(0)

  await page.reload()
  await expect(page.locator('[data-task-id]', { hasText: 'Dev' })).toHaveAttribute('title', title(START, END))
})

test('un échec de persistance remet la barre à sa place et le dit', async ({ page }) => {
  await loginAs(page, 'alice')
  const bar = await projectWithTask(page)
  const before = (await bar.boundingBox())!

  // Seuls les PATCH sont coupés : la création de la tâche (POST) et le chargement de la page
  // doivent aboutir normalement.
  await page.route('**/rest/v1/tasks*', async (route) => {
    if (route.request().method() === 'PATCH') await route.abort('failed')
    else await route.fallback()
  })

  await dragCenter(page, bar, 3 * PX_PER_DAY.day)
  await expect(page.getByText('Modification non enregistrée')).toBeVisible()
  // Retour à l'état d'avant le geste, dates ET géométrie : l'annulation est visible à l'écran,
  // pas seulement dans le store.
  await expect(bar).toHaveAttribute('title', title(START, END))
  expect((await bar.boundingBox())!.x).toBeCloseTo(before.x, 0)

  await page.unroute('**/rest/v1/tasks*')
  await page.reload()
  await expect(page.locator('[data-task-id]', { hasText: 'Dev' })).toHaveAttribute('title', title(START, END))
})

test('glisser une barre ne ramène pas la vue à son point de départ', async ({ page }) => {
  await loginAs(page, 'alice')
  const bar = await projectWithTask(page)
  const scroller = page.getByTestId('gantt-scroll')

  // L'utilisateur défile à la main ; le recentrage one-shot de la tâche 9 est déjà consommé.
  await scroller.evaluate((el) => { el.scrollLeft -= 120 })
  const scrolled = await scroller.evaluate((el) => el.scrollLeft)
  expect(scrolled).toBeGreaterThan(0)

  await dragCenter(page, bar, 2 * PX_PER_DAY.day)
  await expect(bar).toHaveAttribute('title', title(START + 2, END + 2))
  expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(scrolled)
})

test('un lecteur ne peut pas déplacer une barre', async ({ page }) => {
  const patchs: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/tasks')) patchs.push(r.url())
  })

  await loginAs(page, 'carol')
  await page.goto('/projects/c0000000-0000-0000-0000-000000000001')
  const bar = page.locator('[data-task-id]', { hasText: 'Spécifications' })
  await expect(bar).toHaveCount(1)
  const avant = (await bar.getAttribute('title'))!

  // Aucune poignée de redimensionnement n'est même rendue pour un lecteur.
  await expect(bar.locator('[data-handle]')).toHaveCount(0)

  // Le geste est joué EN DÉTAIL pour observer l'APERÇU, pointeur encore enfoncé. Comparer
  // seulement l'état final ne prouverait rien : sans la garde, le geste écrit, la RLS refuse
  // et l'annulation de la tâche 8 remet exactement les mêmes dates — l'avant et l'après sont
  // identiques dans les deux cas. Ce qui distingue les deux, c'est que la barre d'un lecteur
  // ne doit pas bouger pendant le geste. (Vérifié : sans la garde, l'aperçu se décale, un
  // PATCH part et un toast apparaît.)
  const box = (await bar.boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 3 * PX_PER_DAY.day, y, { steps: 4 })
  expect(await bar.getAttribute('title')).toBe(avant)
  await page.mouse.up()

  // Le clic sélectionne quand même : le glisser-déposer a remplacé le `onClick` de la barre,
  // et la sélection reste ouverte aux lecteurs.
  await expect(bar).toHaveClass(/outline-dashed/)

  await page.reload()
  await expect(page.locator('[data-task-id]', { hasText: 'Spécifications' })).toHaveAttribute('title', avant)
  // Aucune écriture n'a même été TENTÉE : la RLS n'a pas eu à servir de rempart.
  expect(patchs).toEqual([])
})

/**
 * Double-clic HUMAIN : les deux clics ne tombent jamais exactement au même pixel, et le pointeur
 * bouge un peu entre l'enfoncement et le relâchement. Le tremblement reste sous le seuil de
 * déclenchement — c'est précisément le geste qui, sans seuil, décalait la tâche d'un jour au zoom
 * mois (2 px = une demi-colonne) et l'écrivait en base.
 */
async function trembledDoubleClick(page: Page, x: number, y: number) {
  const tremble = DRAG_THRESHOLD_PX - 1
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + tremble, y)
  await page.mouse.up()
  await page.mouse.move(x + tremble, y + 1)
  await page.mouse.down({ clickCount: 2 })
  await page.mouse.move(x, y + 1)
  await page.mouse.up({ clickCount: 2 })
}

/**
 * Répartition RÉELLE des cibles sur la largeur de la barre, pixel par pixel : à chaque abscisse,
 * quel élément recevrait le `pointerdown`. C'est la seule mesure qui distingue « la barre a des
 * poignées » de « la barre n'est PLUS QUE des poignées ».
 */
async function cibles(bar: Locator): Promise<{ counts: Record<string, number>; centre: string }> {
  return await bar.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const cible = (x: number) => {
      const hit = document.elementFromPoint(x, r.top + r.height / 2)
      const handle = hit?.closest('[data-handle]')?.getAttribute('data-handle')
      if (handle) return handle
      return hit && hit.closest('[data-task-id]') === el ? 'deplacement' : 'autre'
    }
    const counts: Record<string, number> = { deplacement: 0, 'resize-start': 0, 'resize-end': 0, autre: 0 }
    for (let i = 0; i < Math.round(r.width); i++) counts[cible(r.left + i + 0.5)] += 1
    return { counts, centre: cible(r.left + r.width / 2) }
  })
}

test('un double-clic tremblé au zoom mois ouvre l\'éditeur sans rien écrire', async ({ page }) => {
  const patchs: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/tasks')) patchs.push(r.url())
  })

  await loginAs(page, 'alice')
  const bar = await projectWithTask(page)
  await page.getByRole('button', { name: 'Mois' }).click()
  await expect(bar).toBeInViewport()
  // Le pire cas est bien réuni : au zoom mois la barre de 3 jours fait 12 px, et une demi-colonne
  // — le seuil d'arrondi de `pxToDays` — n'y vaut que 2 px.
  const box = (await bar.boundingBox())!
  expect(box.width).toBeLessThan(PX_PER_DAY.day / 2)

  await trembledDoubleClick(page, box.x + box.width / 2, box.y + box.height / 2)

  // L'éditeur de la tâche 10 s'ouvre toujours : le seuil ne casse pas la cohabitation.
  await expect(page.getByRole('dialog', { name: 'Modifier la tâche' })).toBeVisible()
  await page.getByRole('button', { name: 'Annuler' }).click()

  await expect(bar).toHaveAttribute('title', title(START, END))
  // L'observable qui distingue vraiment les deux mondes : aucune écriture n'a été TENTÉE.
  // Comparer les seules dates finales ne suffirait pas — l'aperçu, lui, est déjà retombé.
  expect(patchs).toEqual([])

  await page.reload()
  await expect(page.locator('[data-task-id]', { hasText: 'Dev' })).toHaveAttribute('title', title(START, END))
})

test('une barre déposée tombe sur le bon jour aux trois zooms', async ({ page }) => {
  await loginAs(page, 'alice')
  const bar = await projectWithTask(page)

  // La plage affichée est désormais ÉTENDUE jusqu'à remplir l'écran aux zooms semaine et mois.
  // L'extension ne porte que sur la FIN : `dateToX` mesure depuis `range.start`, donc toucher au
  // début décalerait l'origine et une barre déposée tomberait un ou plusieurs jours à côté. Ce
  // test l'exige en dates réelles, pas en pixels : +2 jours puis −1 jour, à chaque zoom.
  let start = START
  let end = END
  for (const zoom of ['Jour', 'Semaine', 'Mois'] as const) {
    await page.getByRole('button', { name: zoom, exact: true }).click()
    await expect(bar).toBeInViewport()
    const px = PX_PER_DAY[({ Jour: 'day', Semaine: 'week', Mois: 'month' } as const)[zoom]]

    await dragCenter(page, bar, 2 * px)
    start += 2
    end += 2
    await expect(bar, `zoom ${zoom} : +2 jours`).toHaveAttribute('title', title(start, end))

    await dragCenter(page, bar, -1 * px)
    start -= 1
    end -= 1
    await expect(bar, `zoom ${zoom} : −1 jour`).toHaveAttribute('title', title(start, end))
  }

  // Et la dernière position survit au rechargement : ce sont bien des dates persistées, pas un
  // aperçu qui aurait l'air juste à l'écran.
  await page.reload()
  await expect(page.locator('[data-task-id]', { hasText: 'Dev' })).toHaveAttribute('title', title(start, end))
})

test('la barre reste déplaçable ET redimensionnable aux trois zooms', async ({ page }) => {
  await loginAs(page, 'alice')
  const bar = await projectWithTask(page)

  const releve: Record<string, unknown> = {}
  for (const zoom of ['Jour', 'Semaine', 'Mois']) {
    await page.getByRole('button', { name: zoom }).click()
    await expect(bar).toBeInViewport()
    const largeur = Math.round((await bar.boundingBox())!.width)
    const { counts: c, centre } = await cibles(bar)
    releve[zoom] = { largeur, centre, ...c }
    const detail = `zoom ${zoom} : largeur=${largeur}px centre=${centre} ${JSON.stringify(c)}`

    // La barre n'est pas masquée par la sidebar collante : sans quoi la mesure ne dirait rien.
    expect(c.autre, detail).toBe(0)
    // Elle reste SAISISSABLE pour être déplacée — au moins la moitié de ses pixels. Avec des
    // poignées de 8 px en dur, il n'en restait aucun au zoom mois (12 px de barre).
    expect(c.deplacement, detail).toBeGreaterThanOrEqual(Math.floor(largeur / 2) - 1)
    // ET au bon endroit : saisir une barre EN SON MILIEU doit la déplacer. Compter les pixels ne
    // suffit pas — poignées posées à l'intérieur de la bordure de 3 px, une barre de 12 px avait
    // bien 6 px « déplaçables », mais c'étaient ses deux liserés, les poignées occupant le milieu.
    expect(centre, detail).toBe('deplacement')
    // Et elle reste redimensionnable : borner les poignées ne revient pas à les supprimer.
    expect(c['resize-start'], detail).toBeGreaterThan(0)
    expect(c['resize-end'], detail).toBeGreaterThan(0)
  }
  console.log('répartition des cibles :', JSON.stringify(releve))
})
