import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'
import { roleOf, rowsToMembers } from '@/lib/projects/members'
import { ProjectHeader } from '@/components/layout/ProjectHeader'
import { ProjectLoadError } from '@/components/gantt/ProjectLoadError'

/**
 * Layout de TOUTES les pages d'un projet. Il ne lit que ce que l'en-tête affiche — le projet et
 * ses membres, en UNE requête — et ne connaît ni les tâches ni les tickets : chaque page garde
 * ses propres lectures. Une requête de plus par navigation, acceptée par la spec, contre un
 * layout qui ne grossit pas avec chaque écran.
 */
export default async function ProjectLayout({ children, params }: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()
  const supabase = await createClient()

  // La RLS ne montre le projet qu'à ses membres : un identifiant inconnu et un projet étranger
  // donnent tous deux zéro ligne, donc la même 404 — volontairement indistinguables.
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, tickets_enabled, memberships(user_id, role, profiles(display_name, email, avatar_url, color))')
    .eq('id', id)
    .maybeSingle()

  // Un échec technique n'est PAS une absence : le confondre avec une 404 ferait croire que le
  // projet a disparu. Cause au journal serveur, message générique à l'écran.
  if (error) {
    console.error(`[projects/${id}] lecture "projects" (layout) en échec :`, error.message)
    return <ProjectLoadError retryHref={`/projects/${id}`} />
  }
  if (!project) notFound()

  const myRole = roleOf(project.memberships, user.id)
  if (!myRole) notFound()

  return (
    // Hauteur de la fenêtre, en colonne : l'en-tête prend ce qu'il lui faut (une rangée au
    // bureau, deux sur téléphone) et la page le reste. Une hauteur calculée à la main
    // (`100dvh - 3.5rem`) se trompait dès que l'en-tête passait sur deux rangées.
    <div className="flex h-dvh flex-col">
      <ProjectHeader
        projectId={project.id}
        projectName={project.name}
        ticketsEnabled={project.tickets_enabled}
        myRole={myRole}
        members={rowsToMembers(project.memberships)}
      />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
