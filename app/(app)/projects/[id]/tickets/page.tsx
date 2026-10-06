import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { rowToTicket } from '@/lib/tickets/repository'
import type { Member, Role } from '@/lib/gantt/types'
import type { TicketTaskOption } from '@/lib/tickets/types'
import { TicketsPage } from '@/components/tickets/TicketsPage'
import { TicketsDisabled } from '@/components/tickets/TicketsDisabled'
import { ProjectLoadError } from '@/components/gantt/ProjectLoadError'

export default async function ProjectTicketsPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ vue?: string; nouveau?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Même politique que la page du Gantt : `maybeSingle`, car l'absence de ligne est le cas
  // nominal d'un identifiant inconnu OU d'un projet auquel on n'a pas accès — les deux se
  // répondent par un 404, volontairement indistinguables.
  const { data: project, error: projectError } = await supabase
    .from('projects').select('id, name, tickets_enabled').eq('id', id).maybeSingle()
  if (projectError) return renderLoadError(id, [['projects', projectError]])
  if (!project) notFound()

  const { data: memberships, error: membershipsError } = await supabase
    .from('memberships').select('user_id, role, profiles(display_name, email, avatar_url, color)').eq('project_id', id)
  if (membershipsError) return renderLoadError(id, [['memberships', membershipsError]], project.name)

  // Le rôle se dérive des lignes BRUTES, jamais de la projection d'affichage `members` :
  // un profil masqué par la RLS priverait sinon l'utilisateur de ses droits d'écriture.
  const rows = memberships ?? []
  const myRole: Role = rows.find((m) => m.user_id === user.id)?.role ?? 'viewer'

  // Tickets désactivés : le propriétaire se voit proposer de les activer, tout autre membre
  // reçoit un 404. Ne pas offrir une porte qui se referme.
  if (!project.tickets_enabled) {
    if (myRole !== 'owner') notFound()
    return <TicketsDisabled projectId={project.id} projectName={project.name} />
  }

  // `.eq('project_id', id)` sur tickets ET tasks : SEUL rempart d'isolation inter-projets à ce
  // niveau. La RLS autorise la lecture de toutes les lignes des projets dont on est membre,
  // elle ne filtre pas sur CE projet-ci. Ne jamais retirer ces filtres.
  const [ticketsRes, tasksRes] = await Promise.all([
    supabase.from('tickets').select('*').eq('project_id', id).order('number'),
    supabase.from('tasks').select('id, title, type').eq('project_id', id).order('sort_order'),
  ])

  // Une lecture en échec ne doit JAMAIS se présenter comme une liste vide : un kanban vide
  // affiché sur un `tickets` en erreur pousse l'utilisateur à recréer des tickets qui existent
  // déjà. On refuse donc de rendre l'écran sur des données partielles.
  const failures: Array<[string, { message: string }]> = []
  if (ticketsRes.error) failures.push(['tickets', ticketsRes.error])
  if (tasksRes.error) failures.push(['tasks', tasksRes.error])
  if (failures.length > 0) return renderLoadError(id, failures, project.name)

  const members: Member[] = rows.flatMap((m) => {
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

  // Un GROUPE n'est pas une cible de rattachement : c'est un contenant, ses dates viennent de
  // ses enfants. Rattacher un ticket à une phase entière ne veut rien dire.
  const tasks: TicketTaskOption[] = (tasksRes.data ?? [])
    .filter((t) => t.type !== 'group')
    .map((t) => ({ id: t.id, title: t.title }))

  // `?nouveau=` est une commodité de navigation, pas une saisie à valider : une valeur qui ne
  // désigne aucune tâche DE CE PROJET ouvre simplement l'éditeur sans rattachement.
  const initialCreate = query.nouveau === undefined
    ? null
    : { taskId: tasks.some((t) => t.id === query.nouveau) ? query.nouveau : null }

  return (
    <TicketsPage
      payload={{
        projectId: project.id,
        projectName: project.name,
        myRole,
        members,
        tasks,
        tickets: (ticketsRes.data ?? []).map(rowToTicket),
      }}
      view={query.vue === 'liste' ? 'list' : 'board'}
      initialCreate={initialCreate}
    />
  )
}

/** Politique d'erreur du projet : cause technique au journal serveur, message générique à l'écran. */
function renderLoadError(projectId: string, failures: Array<[string, { message: string }]>, projectName?: string) {
  for (const [what, error] of failures) {
    console.error(`[projects/${projectId}/tickets] lecture "${what}" en échec :`, error.message)
  }
  return <ProjectLoadError retryHref={`/projects/${projectId}/tickets`} projectName={projectName} />
}
