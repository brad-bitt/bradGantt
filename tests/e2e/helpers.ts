import { expect, type Page } from '@playwright/test'
import { loadEnvConfig } from '@next/env'
import path from 'node:path'

// Charge .env.local (jamais lu automatiquement par le process Node de Playwright,
// contrairement au serveur `next dev` lancé en webServer) pour donner à ce fichier
// accès à SUPABASE_SERVICE_ROLE_KEY : nécessaire pour poser des memberships de test
// qu'aucune UI de cette branche ne permet encore de créer (invitations = plan suivant).
loadEnvConfig(path.resolve(__dirname, '../..'))

export const USERS = {
  alice: { id: 'a0000000-0000-0000-0000-000000000001', email: 'alice@test.local', name: 'Alice Test' },
  bob: { id: 'a0000000-0000-0000-0000-000000000002', email: 'bob@test.local', name: 'Bob Test' },
  carol: { id: 'a0000000-0000-0000-0000-000000000003', email: 'carol@test.local', name: 'Carol Test' },
  dave: { id: 'a0000000-0000-0000-0000-000000000004', email: 'dave@test.local', name: 'Dave Test' },
} as const

export async function loginAs(page: Page, who: keyof typeof USERS) {
  await page.goto('/e2e-login')
  await page.getByLabel('Email').fill(USERS[who].email)
  await page.getByLabel('Mot de passe').fill('password123')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL('**/projects')
}

// Écrit directement en PostgREST avec la clé service_role (bypass RLS) — usage
// strictement réservé à la mise en place de fixtures de test (ex. une membership
// qu'aucune UI ne permet encore de créer dans cette branche). On passe par `fetch` brut
// plutôt que par @supabase/supabase-js : ce dernier initialise un client realtime qui
// requiert un WebSocket natif, absent de la version de Node utilisée pour exécuter les
// tests Playwright.
export async function addMembership(projectId: string, userId: string, role: 'editor' | 'viewer') {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/memberships`
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const res = await fetch(url, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ project_id: projectId, user_id: userId, role }),
  })
  if (!res.ok) throw new Error(`addMembership a échoué (${res.status}): ${await res.text()}`)
}

/** Projet de seed dédié aux tickets, en LECTURE SEULE pour les tests : trois tickets, deux tâches. */
export const TICKETS_PROJECT = {
  id: 'c0000000-0000-0000-0000-000000000003',
  name: 'Projet tickets',
  taskId: 'd0000000-0000-0000-0000-0000000000a1',
  taskTitle: 'Développement',
} as const

/**
 * Crée un projet neuf par l'interface et y active les tickets. Tout test qui ÉCRIT passe par
 * là : écrire dans un projet du seed ferait dériver les décomptes que les autres tests lisent.
 */
export async function createProjectWithTickets(page: Page, name: string): Promise<void> {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL('**/projects/**')
  await page.goto('/projects')
  const card = page.getByRole('article', { name })
  // Le menu ⋯ se révèle au survol de la carte : on survole comme le ferait l'utilisateur.
  await card.hover()
  await card.getByRole('button', { name: 'Actions du projet' }).click()
  await page.getByRole('menuitem', { name: 'Activer les tickets' }).click()
  await expect(card.getByRole('link', { name: /^Tickets · \d+$/ })).toBeVisible()
}
