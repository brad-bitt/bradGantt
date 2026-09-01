import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

const DEMO = '/projects/c0000000-0000-0000-0000-000000000001'

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
