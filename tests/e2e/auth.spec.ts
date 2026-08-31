import { test, expect } from '@playwright/test'
import { loginAs, USERS } from './helpers'

test('un anonyme est redirigé vers /login avec next', async ({ page }) => {
  await page.goto('/projects')
  await expect(page).toHaveURL(/\/login\?next=%2Fprojects/)
  await expect(page.getByRole('heading', { name: 'BradGantt' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
})

test('connexion puis déconnexion', async ({ page }) => {
  await loginAs(page, 'alice')
  await expect(page.getByText(USERS.alice.name)).toBeVisible()
  await page.getByRole('button', { name: 'Déconnexion' }).click()
  await expect(page).toHaveURL(/\/login/)
})
