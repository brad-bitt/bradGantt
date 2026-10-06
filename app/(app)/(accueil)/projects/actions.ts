'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateProjectName } from '@/lib/projects/validate'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// Politique d'erreur unifiée (voir la spec) : une erreur de VALIDATION (saisie
// utilisateur invalide, détectable avant tout appel réseau) est retournée dans
// `fieldError` pour un affichage inline dans le formulaire ; un échec de PERSISTANCE
// (réseau, RLS, contrainte serveur) est retourné dans `error`, destiné à un toast — les
// deux ne doivent jamais être signalés en double pour un même échec.
export interface ActionResult {
  fieldError?: string
  error?: string
}

/**
 * Le nom du projet et l'onglet Tickets s'affichent dans l'EN-TÊTE de chaque page du projet.
 * Revalider `/projects` seul laissait l'en-tête sur l'ancien état jusqu'au prochain
 * rechargement ; le motif `[id]` en type `layout` couvre le Gantt, les tickets et les membres.
 */
function revalidateProject() {
  revalidatePath('/projects')
  revalidatePath('/projects/[id]', 'layout')
}

export async function createProject(name: string): Promise<ActionResult & { id?: string }> {
  const v = validateProjectName(name)
  if (!v.ok) return { fieldError: v.error }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_project', { p_name: v.value })
  if (error) return { error: 'Création impossible, réessaie.' }
  revalidatePath('/projects')
  return { id: data.id }
}

export async function renameProject(projectId: string, name: string): Promise<ActionResult> {
  const v = validateProjectName(name)
  if (!v.ok) return { fieldError: v.error }
  const supabase = await createClient()
  const { error, count } = await supabase.from('projects').update({ name: v.value }, { count: 'exact' }).eq('id', projectId)
  // `.eq('id', …)` cible au plus une ligne : `count` doit valoir exactement 1 en cas de
  // succès. `count === 0` laisserait passer un `count` null (en-tête content-range
  // absente de la réponse) comme un faux succès alors que la RLS a refusé l'écriture.
  if (error || count !== 1) return { error: 'Modification non enregistrée' }
  revalidateProject()
  return {}
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error, count } = await supabase.from('projects').delete({ count: 'exact' }).eq('id', projectId)
  if (error || count !== 1) return { error: 'Suppression impossible' }
  revalidatePath('/projects')
  return {}
}

/**
 * Active ou désactive le backlog de tickets d'un projet.
 *
 * L'autorisation n'est PAS vérifiée ici : la policy `projects_update_owner` la porte, et
 * `count !== 1` transforme son refus silencieux en échec explicite. Dupliquer le contrôle dans
 * l'action donnerait deux sources de vérité pour la même règle.
 *
 * Désactiver ne supprime AUCUNE donnée : les tickets restent en base et réapparaissent tels
 * quels à la réactivation. C'est un choix d'affichage, réversible sans conséquence.
 */
export async function setTicketsEnabled(projectId: string, enabled: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('projects')
    .update({ tickets_enabled: enabled }, { count: 'exact' })
    .eq('id', projectId)
  if (error || count !== 1) return { error: 'Modification non enregistrée' }
  revalidateProject()
  return {}
}
