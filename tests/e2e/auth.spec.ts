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
  // Nom, thème et déconnexion sont derrière l'avatar : c'est là qu'on vérifie qui est connecté.
  await page.getByRole('button', { name: 'Menu du compte' }).click()
  await expect(page.getByRole('menu').getByText(USERS.alice.name)).toBeVisible()
  await page.getByRole('menuitem', { name: 'Déconnexion' }).click()
  await expect(page).toHaveURL(/\/login/)
})
