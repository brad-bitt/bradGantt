import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test('créer, renommer puis supprimer un projet', async ({ page }) => {
  await loginAs(page, 'alice')
  const name = `Projet ${Date.now()}`

  // Preuve du réamorçage de la liste après création. Elle ne peut PAS se faire en observant la
  // page : depuis que la création redirige vers le Gantt (tâche 9 du plan 2), Next 15 refait de
  // toute façon une requête serveur au retour sur `/projects`, par le lien comme par le bouton
  // Précédent — retirer `revalidatePath('/projects')` laisse donc la suite verte si l'on se
  // contente de regarder l'écran. On intercepte donc la réponse de la Server Action elle-même :
  // avec `revalidatePath`, Next y joint l'arbre « Mes projets » re-rendu, où figure le nom du
  // projet créé ; sans, la réponse ne porte que l'identifiant.
  let actionBody = ''
  await page.route('**/projects', async (route) => {
    const response = await route.fetch()
    const body = await response.text()
    if (route.request().method() === 'POST') actionBody = body
    await route.fulfill({ response, body })
  })

  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  // Depuis la tâche 9 du plan 2, la création emmène directement dans le Gantt du nouveau
  // projet. On vérifie la redirection, puis on revient à la liste pour la suite du parcours
  // (renommage et suppression, qui se pilotent depuis la carte).
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name })).toBeVisible()
  // C'est ICI que se joue la garantie : la réponse de l'action porte la liste re-rendue.
  expect(actionBody).toContain(name)
  // Retour par navigation client plutôt que par `page.goto` : on reste au plus près du parcours
  // réel. Ce retour ne prouve rien sur la réinvalidation (voir plus haut), il enchaîne le
  // parcours renommage/suppression, qui se pilote depuis la carte.
  await page.getByRole('link', { name: '← Projets' }).click()
  await page.waitForURL('**/projects')
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
