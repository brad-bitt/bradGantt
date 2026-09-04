import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { InvitationDb } from './types'

/**
 * Branche `InvitationDb` sur le client Supabase de l'UTILISATEUR : chaque requête passe donc par
 * la RLS. Les contrôles de `createInvitation` (owner, déjà membre…) sont là pour rendre les
 * refus lisibles, pas pour tenir la sécurité — c'est la base qui la tient.
 */
export function createSupabaseInvitationDb(client: SupabaseClient<Database>, userId: string, projectId: string): InvitationDb {
  const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message) }
  return {
    async getMyRole(projectId) {
      const { data, error } = await client.from('memberships').select('role').eq('project_id', projectId).eq('user_id', userId).maybeSingle()
      fail(error)
      return data?.role ?? null
    },
    async getProjectName(projectId) {
      const { data, error } = await client.from('projects').select('name').eq('id', projectId).maybeSingle()
      fail(error)
      return data?.name ?? null
    },
    async findProfileIdByEmail(email) {
      // RPC security definer : la policy de `profiles` ne laisse plus voir que soi-même
      // et les membres d'un projet partagé, or un invité n'est pas encore membre.
      const { data, error } = await client.rpc('find_invitee_profile', { p_project_id: projectId, p_email: email })
      fail(error)
      return data ?? null
    },
    async isMember(projectId, memberId) {
      const { data, error } = await client.from('memberships').select('user_id').eq('project_id', projectId).eq('user_id', memberId).maybeSingle()
      fail(error)
      return !!data
    },
    async addMember(projectId, memberId, role) {
      const { error } = await client.from('memberships').insert({ project_id: projectId, user_id: memberId, role })
      fail(error)
    },
    async hasPendingInvitation(projectId, email) {
      const { data, error } = await client.from('invitations').select('id').eq('project_id', projectId).ilike('email', email).is('accepted_at', null).maybeSingle()
      fail(error)
      return !!data
    },
    async insertInvitation(inv) {
      const { error } = await client.from('invitations').insert({ project_id: inv.projectId, email: inv.email, role: inv.role, token: inv.token, invited_by: userId })
      fail(error)
    },
  }
}
