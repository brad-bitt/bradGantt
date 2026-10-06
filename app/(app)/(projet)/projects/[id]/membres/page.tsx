import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'
import { roleOf, rowsToMembers } from '@/lib/projects/members'
import type { InviteRole } from '@/lib/invitations/types'
import { MembersPage } from '@/components/members/MembersPage'
import { ProjectLoadError } from '@/components/gantt/ProjectLoadError'

export default async function ProjectMembersRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const supabase = await createClient()

  // L'appartenance est déjà vérifiée par le layout (404 sinon). Les deux lectures portent
  // `.eq('project_id', id)` : la RLS ouvre tous les projets dont on est membre, pas celui-ci.
  const [membershipsRes, invitationsRes] = await Promise.all([
    supabase.from('memberships').select('user_id, role, profiles(display_name, email, avatar_url, color)').eq('project_id', id),
    // La RLS ne montre les invitations qu'à l'owner : pour tout autre membre, liste vide —
    // exactement l'affichage voulu.
    supabase.from('invitations').select('id, email, role, created_at').eq('project_id', id).is('accepted_at', null).order('created_at'),
  ])

  // Une liste de membres en erreur ne se présente jamais comme une liste vide : l'owner se
  // croirait seul et réinviterait tout le monde.
  if (membershipsRes.error) {
    console.error(`[projects/${id}/membres] lecture "memberships" en échec :`, membershipsRes.error.message)
    return <ProjectLoadError retryHref={`/projects/${id}/membres`} />
  }
  // Les invitations ne sont qu'un complément : leur échec n'empêche pas de voir l'équipe.
  if (invitationsRes.error) console.error(`[projects/${id}/membres] lecture "invitations" en échec :`, invitationsRes.error.message)

  const rows = membershipsRes.data ?? []
  return (
    <MembersPage
      projectId={id}
      members={rowsToMembers(rows)}
      invitations={(invitationsRes.data ?? []).map((i) => ({ id: i.id, email: i.email, role: i.role as InviteRole, createdAt: i.created_at }))}
      isOwner={roleOf(rows, user.id) === 'owner'}
    />
  )
}
