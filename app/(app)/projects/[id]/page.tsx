import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { rowToDependency, rowToTask } from '@/lib/gantt/repository'
import { todayISO } from '@/lib/gantt/dates'
import type { Member } from '@/lib/gantt/types'
import { GanttPage } from '@/components/gantt/GanttPage'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // La RLS filtre déjà sur l'appartenance : un non-membre reçoit zéro ligne, d'où le 404.
  // `maybeSingle` plutôt que `single` : l'absence de ligne n'est pas une erreur ici, c'est le cas nominal
  // d'un identifiant inconnu ou d'un projet auquel on n'a pas accès (les deux se répondent par un 404,
  // volontairement indistinguables pour ne pas divulguer l'existence d'un projet).
  const { data: project } = await supabase.from('projects').select('id, name').eq('id', id).maybeSingle()
  if (!project) notFound()

  const [{ data: memberships }, { data: tasks }, { data: deps }] = await Promise.all([
    supabase.from('memberships').select('user_id, role, profiles(display_name, email, avatar_url, color)').eq('project_id', id),
    supabase.from('tasks').select('*').eq('project_id', id).order('sort_order'),
    supabase.from('dependencies').select('*').eq('project_id', id),
  ])

  const members: Member[] = (memberships ?? []).flatMap((m) => {
    // L'embed `profiles` est déclaré nullable par les types générés (jointure non `!inner`) :
    // on écarte la ligne plutôt que de fabriquer un membre sans nom. En pratique la clé étrangère
    // memberships.user_id -> profiles.id le rend toujours présent, sauf si la RLS de `profiles`
    // masquait le profil — auquel cas l'afficher vide serait pire que ne pas l'afficher.
    if (!m.profiles) return []
    return [{
      userId: m.user_id,
      role: m.role,
      displayName: m.profiles.display_name,
      email: m.profiles.email,
      avatarUrl: m.profiles.avatar_url,
      color: m.profiles.color,
    }]
  })
  const myRole = members.find((m) => m.userId === user.id)?.role ?? 'viewer'

  return (
    <GanttPage
      payload={{
        projectId: project.id,
        projectName: project.name,
        myRole,
        members,
        tasks: (tasks ?? []).map(rowToTask),
        dependencies: (deps ?? []).map(rowToDependency),
        today: todayISO(),
      }}
    />
  )
}
