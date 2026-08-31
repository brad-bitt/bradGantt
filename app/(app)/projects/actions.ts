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

export async function createProject(name: string): Promise<{ error?: string; id?: string }> {
  const v = validateProjectName(name)
  if (!v.ok) return { error: v.error }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_project', { p_name: v.value })
  if (error) return { error: 'Création impossible, réessaie.' }
  revalidatePath('/projects')
  return { id: data.id }
}

export async function renameProject(projectId: string, name: string): Promise<{ error?: string }> {
  const v = validateProjectName(name)
  if (!v.ok) return { error: v.error }
  const supabase = await createClient()
  const { error, count } = await supabase.from('projects').update({ name: v.value }, { count: 'exact' }).eq('id', projectId)
  // `.eq('id', …)` cible au plus une ligne : `count` doit valoir exactement 1 en cas de
  // succès. `count === 0` laisserait passer un `count` null (en-tête content-range
  // absente de la réponse) comme un faux succès alors que la RLS a refusé l'écriture.
  if (error || count !== 1) return { error: 'Modification non enregistrée' }
  revalidatePath('/projects')
  return {}
}

export async function deleteProject(projectId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error, count } = await supabase.from('projects').delete({ count: 'exact' }).eq('id', projectId)
  if (error || count !== 1) return { error: 'Suppression impossible' }
  revalidatePath('/projects')
  return {}
}
