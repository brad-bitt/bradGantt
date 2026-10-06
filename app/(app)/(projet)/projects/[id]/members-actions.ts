'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { INVITE_ROLES, type InviteRole } from '@/lib/invitations/types'

const FAIL = 'Modification non enregistrée'

/**
 * Ces trois actions ne vérifient pas les droits : elles écrivent avec le client de
 * l'utilisateur, donc sous RLS, où seul l'owner peut toucher aux memberships et aux
 * invitations. Le `count === 0` est ce qui rend un refus visible — sans lui, une écriture
 * bloquée par la RLS repartirait en succès silencieux, l'écran affichant un changement qui
 * n'a pas eu lieu.
 */
export async function changeMemberRole(projectId: string, userId: string, role: InviteRole): Promise<{ error?: string }> {
  if (!INVITE_ROLES.includes(role)) return { error: 'Rôle invalide' }
  const supabase = await createClient()
  const { error, count } = await supabase.from('memberships').update({ role }, { count: 'exact' }).eq('project_id', projectId).eq('user_id', userId)
  if (error || count === 0) return { error: FAIL }
  revalidatePath(`/projects/${projectId}`)
  return {}
}

export async function removeMember(projectId: string, userId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error, count } = await supabase.from('memberships').delete({ count: 'exact' }).eq('project_id', projectId).eq('user_id', userId)
  if (error || count === 0) return { error: FAIL }
  revalidatePath(`/projects/${projectId}`)
  return {}
}

export async function revokeInvitation(projectId: string, invitationId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error, count } = await supabase.from('invitations').delete({ count: 'exact' }).eq('id', invitationId).eq('project_id', projectId)
  if (error || count === 0) return { error: FAIL }
  revalidatePath(`/projects/${projectId}`)
  return {}
}
