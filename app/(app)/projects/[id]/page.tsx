import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { rowToDependency, rowToTask } from '@/lib/gantt/repository'
import { todayISO } from '@/lib/gantt/dates'
import type { Member, Role } from '@/lib/gantt/types'
import { GanttPage } from '@/components/gantt/GanttPage'
import { ProjectLoadError } from '@/components/gantt/ProjectLoadError'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // La RLS filtre déjà sur l'appartenance : un non-membre reçoit zéro ligne, d'où le 404.
  // `maybeSingle` plutôt que `single` : l'absence de ligne n'est pas une erreur ici, c'est le cas nominal
  // d'un identifiant inconnu ou d'un projet auquel on n'a pas accès (les deux se répondent par un 404,
  // volontairement indistinguables pour ne pas divulguer l'existence d'un projet).
  const { data: project, error: projectError } = await supabase.from('projects').select('id, name').eq('id', id).maybeSingle()
  // Un échec technique n'est PAS une absence de ligne : le confondre avec un 404 ferait croire à
  // l'utilisateur que son projet n'existe plus. Le message reste générique (il ne dit rien de
  // l'existence du projet), seule la cause technique part au journal serveur.
  if (projectError) return renderLoadError(id, [['projects', projectError]])
  if (!project) notFound()

  // `.eq('project_id', id)` sur tasks ET dependencies : c'est le SEUL rempart d'isolation
  // inter-projets à ce niveau. La RLS autorise la lecture de TOUTES les lignes des projets dont
  // on est membre, elle ne filtre donc pas sur CE projet-ci. Verrouillé par
  // tests/e2e/gantt-view.spec.ts (« aucune donnée d'un autre projet ne fuit »), qui s'appuie sur
  // le second projet du seed. Ne jamais retirer ces filtres.
  const [membershipsRes, tasksRes, depsRes] = await Promise.all([
    supabase.from('memberships').select('user_id, role, profiles(display_name, email, avatar_url, color)').eq('project_id', id),
    supabase.from('tasks').select('*').eq('project_id', id).order('sort_order'),
    supabase.from('dependencies').select('*').eq('project_id', id),
  ])

  // Une lecture en échec ne doit jamais se présenter comme un résultat vide : un `tasks` en erreur
  // affiché en « Aucune tâche pour l'instant » pousse l'utilisateur à recréer des tâches qui
  // existent déjà (doublons en base), et un `memberships` en erreur afficherait l'owner en
  // « Lecture seule ». On refuse donc de rendre le Gantt sur des données partielles.
  const failures: Array<[string, { message: string }]> = []
  if (membershipsRes.error) failures.push(['memberships', membershipsRes.error])
  if (tasksRes.error) failures.push(['tasks', tasksRes.error])
  if (depsRes.error) failures.push(['dependencies', depsRes.error])
  if (failures.length > 0) return renderLoadError(id, failures, project.name)

  const memberships = membershipsRes.data ?? []

  const members: Member[] = memberships.flatMap((m) => {
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
  // Le rôle se dérive des lignes `memberships` BRUTES, pas de `members` : cette dernière est une
  // projection d'affichage, filtrée par la visibilité des profils. Un profil masqué priverait
  // silencieusement l'utilisateur de ses droits d'écriture. Une décision d'autorisation ne
  // s'adosse pas à une jointure d'affichage.
  const myRole: Role = memberships.find((m) => m.user_id === user.id)?.role ?? 'viewer'

  return (
    <GanttPage
      payload={{
        projectId: project.id,
        projectName: project.name,
        myRole,
        members,
        tasks: (tasksRes.data ?? []).map(rowToTask),
        dependencies: (depsRes.data ?? []).map(rowToDependency),
        today: todayISO(),
      }}
    />
  )
}

/**
 * Journalise la cause technique de chaque lecture en échec (côté serveur uniquement) et rend
 * l'écran d'erreur générique. Politique d'erreur du projet : cause technique au journal, message
 * générique à l'écran.
 */
function renderLoadError(projectId: string, failures: Array<[string, { message: string }]>, projectName?: string) {
  for (const [what, error] of failures) {
    console.error(`[projects/${projectId}] lecture "${what}" en échec :`, error.message)
  }
  return <ProjectLoadError retryHref={`/projects/${projectId}`} projectName={projectName} />
}
