import { test, expect } from '@playwright/test'
import { loginAs, addMembership, USERS } from './helpers'

// Négatif d'autorisation : un editor ne peut ni renommer ni supprimer un projet dont il
// n'est pas owner. La RLS (projects_update_owner / projects_delete_owner) refuse déjà
// l'écriture au niveau base ; ce test couvre la couche au-dessus — la traduction de ce
// refus en message utilisateur par renameProject/deleteProject (app/(app)/projects/actions.ts)
// — seul endroit de la suite qui l'exerce. On ne peut pas passer par les boutons "Renommer"/
// "Supprimer" de ProjectCard : ils ne sont rendus que pour project.role === 'owner', donc
// invisibles pour bob. On reproduit à la place la requête réelle envoyée par le navigateur
// pour une Server Action (POST sur l'URL de la page, header Next-Action, corps JSON des
// arguments — observé en conditions réelles, capturé ici sur un appel légitime d'alice)
// avec les cookies de session de bob.
test('bob (editor) ne peut ni renommer ni supprimer un projet dont alice est owner', async ({ browser }) => {
  const aliceContext = await browser.newContext()
  const alicePage = await aliceContext.newPage()
  await loginAs(alicePage, 'alice')

  const targetName = `Cible ${Date.now()}`
  await alicePage.getByRole('button', { name: 'Nouveau projet' }).click()
  await alicePage.getByLabel('Nom du projet').fill(targetName)
  await alicePage.getByRole('button', { name: 'Créer' }).click()
  // La création redirige vers la page du projet (tâche 9 du plan 2) : l'identifiant se lit
  // directement dans l'URL, et on revient à la liste pour piloter les cartes.
  await alicePage.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
  const targetId = new URL(alicePage.url()).pathname.split('/').pop()!
  await alicePage.getByRole('link', { name: '← Projets' }).click()
  await alicePage.waitForURL('**/projects')
  const targetCard = alicePage.getByRole('article', { name: targetName })
  await expect(targetCard).toBeVisible()
  // La carte pointe bien vers la page du projet : seule assertion de la suite sur ce lien.
  await expect(targetCard.getByRole('link', { name: targetName })).toHaveAttribute('href', `/projects/${targetId}`)

  // Capture l'ID de la Server Action renameProject via un renommage légitime par alice
  // (owner). Ce même identifiant sert à forger la requête de bob plus bas.
  const [renameReq] = await Promise.all([
    alicePage.waitForRequest((req) => req.method() === 'POST' && !!req.headers()['next-action']),
    (async () => {
      await targetCard.getByRole('button', { name: 'Renommer' }).click()
      await alicePage.getByLabel('Nom du projet').fill(`${targetName} v2`)
      await alicePage.getByRole('button', { name: 'Enregistrer' }).click()
    })(),
  ])
  const renameActionId = renameReq.headers()['next-action']
  await expect(alicePage.getByRole('article', { name: `${targetName} v2` })).toBeVisible()

  // Capture l'ID de deleteProject sur un projet JETABLE distinct (on ne supprime pas le
  // projet cible : il doit rester intact pour l'assertion finale).
  const throwName = `Jetable ${Date.now()}`
  await alicePage.getByRole('button', { name: 'Nouveau projet' }).click()
  await alicePage.getByLabel('Nom du projet').fill(throwName)
  await alicePage.getByRole('button', { name: 'Créer' }).click()
  await alicePage.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
  await alicePage.getByRole('link', { name: '← Projets' }).click()
  await alicePage.waitForURL('**/projects')
  const throwCard = alicePage.getByRole('article', { name: throwName })
  await expect(throwCard).toBeVisible()
  const [deleteReq] = await Promise.all([
    alicePage.waitForRequest((req) => req.method() === 'POST' && !!req.headers()['next-action']),
    (async () => {
      alicePage.once('dialog', (d) => d.accept())
      await throwCard.getByRole('button', { name: 'Supprimer' }).click()
    })(),
  ])
  const deleteActionId = deleteReq.headers()['next-action']

  // Bob devient editor du projet cible : aucune UI d'invitation n'existe encore dans cette
  // branche (plan suivant), la fixture est posée directement via la clé service_role.
  await addMembership(targetId, USERS.bob.id, 'editor')

  const bobContext = await browser.newContext()
  const bobPage = await bobContext.newPage()
  await loginAs(bobPage, 'bob')

  const renameByBob = await bobPage.request.post('/projects', {
    headers: { 'next-action': renameActionId!, 'content-type': 'text/plain;charset=UTF-8', accept: 'text/x-component' },
    data: JSON.stringify([targetId, 'Piraté par bob']),
  })
  expect(await renameByBob.text()).toContain('Modification non enregistrée')

  const deleteByBob = await bobPage.request.post('/projects', {
    headers: { 'next-action': deleteActionId!, 'content-type': 'text/plain;charset=UTF-8', accept: 'text/x-component' },
    data: JSON.stringify([targetId]),
  })
  expect(await deleteByBob.text()).toContain('Suppression impossible')

  // Le projet reste intact : ni renommé ni supprimé par bob.
  await alicePage.reload()
  await expect(alicePage.getByRole('article', { name: `${targetName} v2` })).toBeVisible()

  await aliceContext.close()
  await bobContext.close()
})
