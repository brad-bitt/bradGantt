import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

const DEMO = '/projects/c0000000-0000-0000-0000-000000000001'
/** « Ateliers » du seed : la tâche que le lecteur va essayer de déplacer, éditer, supprimer. */
const ATELIERS = 'd0000000-0000-0000-0000-000000000002'

test('un viewer voit le Gantt sans aucune action d\'édition', async ({ page }) => {
  // Aucune écriture ne doit même être TENTÉE : la RLS n'a pas à servir de dernier rempart.
  const ecritures: string[] = []
  page.on('request', (r) => {
    if (['POST', 'PATCH', 'DELETE'].includes(r.method()) && r.url().includes('/rest/v1/')) {
      ecritures.push(`${r.method()} ${r.url()}`)
    }
  })

  await loginAs(page, 'carol')
  await page.goto(DEMO)
  await expect(page.getByText('Lecture seule')).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Tâche' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Créer une dépendance' })).toHaveCount(0)
  await expect(page.getByLabel('Réordonner')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ajouter une tâche au groupe' })).toHaveCount(0)
  // Le repli d'un groupe est un état PERSISTÉ : il n'est pas offert non plus au lecteur.
  await expect(page.getByRole('button', { name: 'Replier' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Déplier' })).toHaveCount(0)

  const bar = page.locator(`[data-task-id="${ATELIERS}"]`)
  const before = await bar.getAttribute('title')
  const box = (await bar.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(bar).toHaveAttribute('title', before!)

  await bar.dblclick()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await bar.click()
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-task-id]')).toHaveCount(4)

  // La sélection, elle, reste ouverte au lecteur : c'est de la lecture, pas de l'édition.
  await expect(bar).toHaveClass(/outline-dashed/)
  await page.keyboard.press('Escape')
  await expect(bar).not.toHaveClass(/outline-dashed/)

  expect(ecritures).toEqual([])
})

test('un editor peut modifier le projet démo', async ({ page }) => {
  await loginAs(page, 'bob')
  await page.goto(DEMO)
  await expect(page.getByRole('button', { name: '+ Tâche' })).toBeVisible()
  await expect(page.getByText('editor')).toBeVisible()
})
