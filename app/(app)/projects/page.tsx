import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'
import { addDays, parseDate, todayISO } from '@/lib/gantt/dates'
import { projectSummary } from '@/lib/gantt/summary'
import { ProjectCard, type ProjectListItem, type CardTask } from '@/components/project/ProjectCard'
import { NewProjectDialog } from '@/components/project/NewProjectDialog'
import { NoProjects } from '@/components/project/NoProjects'
import { ProjectsOverview } from '@/components/project/ProjectsOverview'
import type { Member } from '@/lib/gantt/types'

/** Horizon des « jalons à venir » du bandeau, en jours, aujourd'hui compris. */
const MILESTONE_HORIZON_DAYS = 14

export default async function ProjectsPage() {
  const user = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('id, name, created_at, tickets_enabled, memberships!inner(role, user_id)')
    .eq('memberships.user_id', user.id)
    .order('created_at', { ascending: false })

  const rows = data ?? []

  // DEUX lectures groupées pour toute la page, jamais une par carte. Les tâches ne ramènent que
  // les colonnes dont la synthèse et la vignette ont besoin — le reste (assigné, rang, repli)
  // n'est lu qu'en ouvrant le projet.
  //
  // SANS filtre `in(project_id, …)` : la RLS restreint déjà les deux tables aux projets dont on
  // est membre, c'est-à-dire exactement ceux que la page liste. Le filtre était donc redondant,
  // et il cassait la page au-delà d'environ 170 projets — la bibliothèque encode chaque
  // identifiant entre guillemets, l'URL dépassait les 8 Ko acceptés par PostgREST et la lecture
  // revenait en « URI too long » : toutes les cartes se rendaient vides d'un coup.
  const [tasksRes, membersRes] = rows.length
    ? await Promise.all([
        supabase.from('tasks').select('project_id, type, title, start_date, end_date, progress, color'),
        supabase.from('memberships').select('project_id, user_id, role, profiles(display_name, email, avatar_url, color)'),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]

  // Un échec de ces lectures d'appoint ne doit PAS priver l'utilisateur de sa liste de projets :
  // les cartes se rendent alors sans chiffres ni avatars, ce qui reste un écran utilisable.
  // Politique d'erreur du projet : la cause technique part au journal serveur, l'écran reste muet.
  if (tasksRes.error) console.error('[projects] lecture "tasks" en échec :', tasksRes.error.message)
  if (membersRes.error) console.error('[projects] lecture "memberships" en échec :', membersRes.error.message)
  const tasksByProject = new Map<string, CardTask[]>()
  for (const t of tasksRes.data ?? []) {
    const list = tasksByProject.get(t.project_id) ?? []
    list.push({ type: t.type, title: t.title, startDate: t.start_date, endDate: t.end_date, progress: t.progress, color: t.color })
    tasksByProject.set(t.project_id, list)
  }

  const membersByProject = new Map<string, Member[]>()
  for (const m of membersRes.data ?? []) {
    if (!m.profiles) continue
    const list = membersByProject.get(m.project_id) ?? []
    list.push({
      userId: m.user_id,
      role: m.role,
      displayName: m.profiles.display_name,
      email: m.profiles.email,
      avatarUrl: m.profiles.avatar_url,
      color: m.profiles.color,
    })
    membersByProject.set(m.project_id, list)
  }

  const today = todayISO()
  const projects: ProjectListItem[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.created_at,
    ticketsEnabled: p.tickets_enabled,
    role: p.memberships[0].role,
    tasks: tasksByProject.get(p.id) ?? [],
    summary: projectSummary(tasksByProject.get(p.id) ?? [], today),
    members: membersByProject.get(p.id) ?? [],
    today,
  }))

  const allTasks = projects.flatMap((p) => p.tasks)
  const horizon = addDays(today, MILESTONE_HORIZON_DAYS - 1)
  const figures = {
    projects: projects.length,
    tasks: allTasks.filter((t) => t.type === 'task').length,
    done: allTasks.filter((t) => t.type === 'task' && t.progress >= 100).length,
    upcomingMilestones: allTasks.filter((t) => t.type === 'milestone' && t.startDate >= today && t.startDate <= horizon).length,
    late: projects.reduce((n, p) => n + p.summary.lateCount, 0),
  }

  return (
    <main className="mx-auto max-w-7xl p-4 space-y-6 sm:p-8 sm:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          {/* La date du jour en surtitre : c'est un tableau de bord, il dit quand on le regarde. */}
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            {format(parseDate(today), 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
          <h1 className="text-4xl">Mes projets</h1>
        </div>
        <NewProjectDialog />
      </div>

      {projects.length === 0 ? (
        <NoProjects />
      ) : (
        <>
          <ProjectsOverview figures={figures} />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => <li key={p.id}><ProjectCard project={p} /></li>)}
          </ul>
        </>
      )}
    </main>
  )
}
