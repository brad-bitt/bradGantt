import { expect, test } from '@playwright/test'
import { createProjectWithTickets, loginAs, TICKETS_PROJECT } from './helpers'

test('le kanban montre les tickets du projet, rangés par statut', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto(`/projects/${TICKETS_PROJECT.id}/tickets`)

  await expect(page.getByRole('region', { name: 'À faire' }).getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'En cours' }).getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'Terminé' }).getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('article', { name: '#1 Brancher la connexion' })).toBeVisible()
  // La tâche liée s'affiche sur la carte : c'est le seul rappel du rattachement côté kanban.
  await expect(page.getByRole('article', { name: '#1 Brancher la connexion' })).toContainText(TICKETS_PROJECT.taskTitle)
})

test('la vue liste filtre par statut et par tâche', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto(`/projects/${TICKETS_PROJECT.id}/tickets?vue=liste`)

  await expect(page.getByRole('row')).toHaveCount(4) // en-tête + trois tickets
  await page.getByLabel('Statut').selectOption('done')
  await expect(page.getByRole('row')).toHaveCount(2)
  await expect(page.getByText('Brancher la connexion')).toBeVisible()

  await page.getByLabel('Statut').selectOption('all')
  await page.getByLabel('Tâche').selectOption({ label: 'Aucune' })
  await expect(page.getByText('Écrire le mode d\'emploi')).toBeVisible()
  await expect(page.getByText('Brancher la connexion')).toHaveCount(0)
})

test('créer un ticket, le déplacer à la souris puis au clavier', async ({ page }) => {
  await loginAs(page, 'alice')
  const name = `Kanban ${Date.now()}`
  await createProjectWithTickets(page, name)
  // On entre par la carte du projet neuf, et le lien est cherché en `exact` : depuis /projects,
  // « Tickets » attraperait aussi la carte « Projet tickets » du seed, en lecture seule.
  await page.getByRole('article', { name }).getByRole('link', { name }).click()
  await page.waitForURL('**/projects/**')
  await page.getByRole('link', { name: 'Tickets', exact: true }).click()
  await page.waitForURL('**/tickets')

  await page.getByRole('button', { name: '+ Ticket' }).click()
  await page.getByLabel('Titre').fill('Premier ticket')
  await page.getByRole('button', { name: 'Créer' }).click()

  // Le numéro vient du serveur : un projet neuf commence à #1.
  const card = page.getByRole('article', { name: '#1 Premier ticket' })
  await expect(page.getByRole('region', { name: 'À faire' }).getByRole('article')).toHaveCount(1)

  // Glisser jusqu'à la colonne « Terminé ». Le geste est au POINTEUR : une souris Playwright
  // suffit, là où un glisser-déposer HTML natif aurait demandé une simulation à part.
  const target = page.getByRole('region', { name: 'Terminé' })
  const from = await card.boundingBox()
  const to = await target.boundingBox()
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
  await page.mouse.down()
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(target.getByRole('article', { name: '#1 Premier ticket' })).toBeVisible()

  // Retour en arrière par la flèche, seul chemin praticable au clavier.
  await card.getByRole('button', { name: 'Déplacer vers En cours' }).click()
  await expect(page.getByRole('region', { name: 'En cours' }).getByRole('article', { name: '#1 Premier ticket' })).toBeVisible()

  // Le statut a bien été PERSISTÉ, pas seulement appliqué à l'écran.
  await page.reload()
  await expect(page.getByRole('region', { name: 'En cours' }).getByRole('article', { name: '#1 Premier ticket' })).toBeVisible()

  // L'éditeur s'ouvre au DOUBLE-clic, comme les barres du Gantt : un clic simple suit chaque
  // dépôt, il ne doit pas ouvrir la modale.
  await card.dblclick()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Titre')).toHaveValue('Premier ticket')
})

test('un ticket rattaché à une tâche fait apparaître le compteur dans la frise', async ({ page }) => {
  await loginAs(page, 'alice')
  const name = `Compteur ${Date.now()}`
  await createProjectWithTickets(page, name)
  await page.getByRole('article', { name }).getByRole('link', { name }).click()
  await page.waitForURL('**/projects/**')

  // Une tâche, puis un ticket créé DEPUIS son éditeur : c'est le chemin que la spec décrit.
  await page.getByRole('button', { name: '+ Tâche' }).click()
  await page.getByLabel('Titre').fill('Développement')
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.locator('[data-row-task-id]', { hasText: 'Développement' }).dblclick()
  await expect(page.getByText('Aucun ticket rattaché.')).toBeVisible()
  await page.getByRole('link', { name: '+ Nouveau ticket' }).click()

  // L'éditeur s'ouvre déjà rattaché : `?nouveau=` a pré-rempli le sélecteur.
  await page.waitForURL('**/tickets?nouveau=**')
  await expect(page.getByLabel('Tâche liée')).toHaveValue(/.+/)
  await page.getByLabel('Titre').fill('Brancher la connexion')
  await page.getByRole('button', { name: 'Créer' }).click()

  await page.getByRole('link', { name: '← Frise' }).click()
  await page.waitForURL('**/projects/**')
  await expect(page.getByLabel('0 ticket terminé sur 1')).toBeVisible()
})

test('un lecteur voit les tickets sans aucune commande d\'écriture', async ({ page }) => {
  await loginAs(page, 'carol')
  await page.goto(`/projects/${TICKETS_PROJECT.id}/tickets`)

  await expect(page.getByText('Lecture seule')).toBeVisible()
  await expect(page.getByRole('article', { name: '#1 Brancher la connexion' })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Ticket' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Déplacer vers/ })).toHaveCount(0)

  // Ni clic ni double-clic sur une carte n'ouvre de formulaire : chaque écriture serait
  // refusée par la RLS. Le double-clic est le geste qui ouvre l'éditeur d'un rédacteur.
  const card = page.getByRole('article', { name: '#1 Brancher la connexion' })
  await card.click()
  await card.dblclick()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('un projet sans tickets n\'offre ni lien ni page, sauf à son propriétaire', async ({ page }) => {
  const demoId = 'c0000000-0000-0000-0000-000000000001'

  // Une lectrice du projet démo : aucun lien dans la barre d'outils, et la page renvoie un 404.
  await loginAs(page, 'carol')
  await page.goto(`/projects/${demoId}`)
  await expect(page.getByRole('link', { name: 'Tickets' })).toHaveCount(0)
  const response = await page.goto(`/projects/${demoId}/tickets`)
  expect(response?.status()).toBe(404)

  // La propriétaire, elle, se voit proposer d'activer.
  await loginAs(page, 'alice')
  await page.goto(`/projects/${demoId}/tickets`)
  await expect(page.getByRole('button', { name: 'Activer les tickets' })).toBeVisible()
  // On n'active PAS : le projet démo doit rester sans tickets pour les autres specs.
})
