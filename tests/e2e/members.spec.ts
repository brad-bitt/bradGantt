import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers'

async function newProject(page: Page, name: string) {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
  return page.url()
}

/** La page Membres, atteinte par son onglet : c'est le chemin que la spec décrit. */
async function openMembers(page: Page) {
  await page.getByRole('navigation', { name: 'Sections du projet' }).getByRole('link', { name: 'Membres' }).click()
  await page.waitForURL('**/membres')
  return page.getByRole('region', { name: 'Membres' })
}

/** Les membres uniquement : la section « invitations en attente » a sa propre liste. */
const memberItems = (page: Page) => page.getByRole('region', { name: 'Membres' }).getByTestId('members-list').getByRole('listitem')

test('owner : ajouter un membre existant, changer son rôle, le retirer', async ({ page, browser }) => {
  await loginAs(page, 'alice')
  const url = await newProject(page, `Membres ${Date.now()}`)

  const region = await openMembers(page)
  await expect(memberItems(page)).toHaveCount(1)

  await region.getByLabel('Email').fill('dave@test.local')
  await region.getByLabel('Rôle', { exact: true }).selectOption('viewer')
  await region.getByRole('button', { name: 'Inviter' }).click()
  await expect(memberItems(page)).toHaveCount(2)
  const dave = memberItems(page).filter({ hasText: 'Dave Test' })
  await expect(dave.getByLabel('Rôle de Dave Test')).toHaveValue('viewer')

  await region.getByLabel('Email').fill('dave@test.local')
  await region.getByRole('button', { name: 'Inviter' }).click()
  await expect(region.getByRole('alert')).toHaveText('Cette personne est déjà membre')

  await dave.getByLabel('Rôle de Dave Test').selectOption('editor')
  await expect(dave.getByLabel('Rôle de Dave Test')).toHaveValue('editor')

  // Le rôle n'est pas qu'un affichage : Dave doit réellement pouvoir écrire dans ce projet.
  const daveCtx = await browser.newContext()
  const davePage = await daveCtx.newPage()
  await loginAs(davePage, 'dave')
  await davePage.goto(url)
  await expect(davePage.getByRole('button', { name: '+ Tâche' })).toBeVisible()

  page.once('dialog', (d) => d.accept())
  await dave.getByRole('button', { name: 'Retirer' }).click()
  await expect(memberItems(page)).toHaveCount(1)

  // Et le retrait lui reprend l'accès, pas seulement la ligne dans la liste.
  const res = await davePage.goto(url)
  expect(res?.status()).toBe(404)
  await daveCtx.close()
})

test('owner : inviter une adresse sans compte laisse une invitation en attente, révocable', async ({ page }) => {
  await loginAs(page, 'alice')
  await newProject(page, `Invits ${Date.now()}`)
  const region = await openMembers(page)

  const inconnu = `inconnu-${Date.now()}@test.local`
  await region.getByLabel('Email').fill(inconnu)
  await region.getByRole('button', { name: 'Inviter' }).click()

  // Personne n'a été ajouté : c'est une invitation, pas une membership.
  await expect(memberItems(page)).toHaveCount(1)
  const pending = region.getByTestId('pending-list').getByRole('listitem')
  await expect(pending).toHaveCount(1)
  await expect(pending.first()).toContainText(inconnu)
  await expect(region.getByTestId('invite-url')).toContainText('/invite/')

  // Une seconde invitation pour la même adresse est refusée.
  await region.getByLabel('Email').fill(inconnu)
  await region.getByRole('button', { name: 'Inviter' }).click()
  await expect(region.getByRole('alert')).toHaveText('Une invitation est déjà en attente pour cette adresse')

  await region.getByRole('button', { name: 'Révoquer' }).click()
  await expect(region.getByTestId('pending-list')).toHaveCount(0)
})

test('editor : voit les membres mais aucune commande', async ({ page }) => {
  await loginAs(page, 'bob')
  // Lecture seule du projet démo : on ne fait que regarder.
  await page.goto('/projects/c0000000-0000-0000-0000-000000000001/membres')
  const region = page.getByRole('region', { name: 'Membres' })
  await expect(memberItems(page)).toHaveCount(3)
  await expect(region.getByRole('button', { name: 'Inviter' })).toHaveCount(0)
  await expect(region.getByRole('button', { name: 'Retirer' })).toHaveCount(0)
})
