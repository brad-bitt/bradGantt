import type { Page } from '@playwright/test'

export const USERS = {
  alice: { email: 'alice@test.local', name: 'Alice Test' },
  bob: { email: 'bob@test.local', name: 'Bob Test' },
  carol: { email: 'carol@test.local', name: 'Carol Test' },
  dave: { email: 'dave@test.local', name: 'Dave Test' },
} as const

export async function loginAs(page: Page, who: keyof typeof USERS) {
  await page.goto('/e2e-login')
  await page.getByLabel('Email').fill(USERS[who].email)
  await page.getByLabel('Mot de passe').fill('password123')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL('**/projects')
}
