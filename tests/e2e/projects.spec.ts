import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test('créer, renommer puis supprimer un projet', async ({ page }) => {
  await loginAs(page, 'alice')
  const name = `Projet ${Date.now()}`

  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  const card = page.getByRole('article', { name })
  await expect(card).toBeVisible()
  await expect(card.getByText('owner')).toBeVisible()

  await card.getByRole('button', { name: 'Renommer' }).click()
  await page.getByLabel('Nom du projet').fill(`${name} v2`)
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('article', { name: `${name} v2` })).toBeVisible()

  page.once('dialog', (d) => d.accept())
  await page.getByRole('article', { name: `${name} v2` }).getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByRole('article', { name: `${name} v2` })).toHaveCount(0)
})

test('un nom vide est refusé', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByRole('button', { name: 'Créer' }).click()
  // Scopé à la boîte de dialogue : Next.js monte en permanence son propre role="alert"
  // (AppRouterAnnouncer), donc un getByRole('alert') global matche 2 éléments.
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Le nom est requis')
})
