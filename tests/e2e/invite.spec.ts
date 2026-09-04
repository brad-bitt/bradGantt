import { test, expect, type Browser, type Page } from '@playwright/test'
import { loginAs } from './helpers'

/** Invite une adresse SANS compte et récupère le lien, exposé seulement sous `E2E_ENABLED`. */
async function inviteUnknown(page: Page, email: string, role: 'editor' | 'viewer') {
  await page.getByRole('button', { name: 'Membres' }).click()
  const dialog = page.getByRole('dialog', { name: 'Membres' })
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByLabel('Rôle', { exact: true }).selectOption(role)
  await dialog.getByRole('button', { name: 'Inviter' }).click()
  const text = await dialog.getByTestId('invite-url').textContent()
  const url = text!.match(/https?:\/\/\S+/)![0]
  await page.keyboard.press('Escape')
  return url
}

async function signUp(browser: Browser, email: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/e2e-login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill('password123')
  await page.getByRole('button', { name: 'Créer le compte' }).click()
  await page.waitForURL('**/projects')
  return { ctx, page }
}

test('invitation par lien : acceptation, réutilisation refusée, mauvais compte', async ({ page, browser }) => {
  await loginAs(page, 'alice')
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(`Invit ${Date.now()}`)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
  const projectUrl = page.url()

  const stamp = Date.now()
  const frankEmail = `frank-${stamp}@test.local`
  const frankUrl = await inviteUnknown(page, frankEmail, 'viewer')
  const graceUrl = await inviteUnknown(page, `grace-${stamp}@test.local`, 'editor')

  await page.getByRole('button', { name: 'Membres' }).click()
  await expect(page.getByRole('dialog').getByTestId('pending-list')).toContainText(frankEmail)
  await page.keyboard.press('Escape')

  // Anonyme → renvoyé au login, avec le lien d'invitation en `next`.
  const anon = await browser.newContext()
  const anonPage = await anon.newPage()
  await anonPage.goto(frankUrl)
  await expect(anonPage).toHaveURL(/\/login\?next=%2Finvite%2F/)
  await anon.close()

  // Frank s'inscrit puis accepte : il atterrit dans le projet, en lecture seule.
  const frank = await signUp(browser, frankEmail)
  await frank.page.goto(frankUrl)
  await expect(frank.page).toHaveURL(projectUrl)
  await expect(frank.page.getByText('Lecture seule')).toBeVisible()

  // Le token est à usage unique.
  await frank.page.goto(frankUrl)
  await expect(frank.page.getByText('Lien invalide ou déjà utilisé')).toBeVisible()
  await frank.ctx.close()

  // Bob, connecté sous une autre adresse, ouvre l'invitation de Grace : refusée, avec une sortie.
  const bobCtx = await browser.newContext()
  const bobPage = await bobCtx.newPage()
  await loginAs(bobPage, 'bob')
  await bobPage.goto(graceUrl)
  await expect(bobPage.getByText('Cette invitation est destinée à une autre adresse')).toBeVisible()
  await bobPage.getByRole('button', { name: 'Changer de compte' }).click()
  await expect(bobPage).toHaveURL(/\/login\?next=%2Finvite%2F/)
  await bobCtx.close()

  // Côté owner : Frank a quitté les invitations en attente pour la liste des membres.
  await page.reload()
  await page.getByRole('button', { name: 'Membres' }).click()
  const dialog = page.getByRole('dialog', { name: 'Membres' })
  await expect(dialog.getByTestId('pending-list')).not.toContainText(frankEmail)
  await expect(dialog.getByTestId('members-list')).toContainText(frankEmail)
})
