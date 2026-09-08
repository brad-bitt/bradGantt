import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'
import { todayISO } from '@/lib/gantt/dates'
import { projectSummary, type SummaryTask } from '@/lib/gantt/summary'
import { ProjectCard, type ProjectListItem } from '@/components/project/ProjectCard'
import { NewProjectDialog } from '@/components/project/NewProjectDialog'
import { NoProjects } from '@/components/project/NoProjects'
import type { Member } from '@/lib/gantt/types'

export default async function ProjectsPage() {
  const user = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('id, name, created_at, memberships!inner(role, user_id)')
    .eq('memberships.user_id', user.id)
    .order('created_at', { ascending: false })

  const rows = data ?? []
  const ids = rows.map((p) => p.id)

  // DEUX lectures groupées pour toute la page, jamais une par carte : `in(...)` sur l'ensemble
  // des identifiants garde le coût constant quel que soit le nombre de projets. Les tâches ne
  // ramènent que les cinq colonnes dont `projectSummary` a besoin — le reste (titre long,
  // couleur, avancement détaillé) n'est lu qu'en ouvrant le projet.
  // La RLS restreint déjà les deux tables aux projets dont on est membre ; le filtre `in` ne
  // fait que borner la lecture à ceux qu'on affiche.
  const [tasksRes, membersRes] = ids.length
    ? await Promise.all([
        supabase.from('tasks').select('project_id, type, title, start_date, end_date, progress').in('project_id', ids),
        supabase.from('memberships').select('project_id, user_id, role, profiles(display_name, email, avatar_url, color)').in('project_id', ids),
      ])
    : [{ data: [] }, { data: [] }]

  // Un échec de ces lectures d'appoint ne doit PAS priver l'utilisateur de sa liste de projets :
  // les cartes se rendent alors sans chiffres ni avatars, ce qui reste un écran utilisable.
  const tasksByProject = new Map<string, SummaryTask[]>()
  for (const t of tasksRes.data ?? []) {
    const list = tasksByProject.get(t.project_id) ?? []
    list.push({ type: t.type, title: t.title, startDate: t.start_date, endDate: t.end_date, progress: t.progress })
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
    role: p.memberships[0].role,
    summary: projectSummary(tasksByProject.get(p.id) ?? [], today),
    members: membersByProject.get(p.id) ?? [],
  }))

  const totalTasks = projects.reduce((n, p) => n + p.summary.taskCount, 0)
  const totalLate = projects.reduce((n, p) => n + p.summary.lateCount, 0)

  return (
    <main className="p-8 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl">Mes projets</h1>
          {/* Une ligne de contexte plutôt qu'un titre seul : on sait d'un coup d'œil ce qu'il y
              a derrière, et le retard éventuel se voit avant d'ouvrir quoi que ce soit. */}
          {projects.length > 0 && (
            <p className="font-mono text-sm text-ink-soft">
              {projects.length} projet{projects.length > 1 ? 's' : ''} · {totalTasks} tâche{totalTasks > 1 ? 's' : ''}
              {totalLate > 0 && <span className="font-bold text-danger"> · {totalLate} en retard</span>}
            </p>
          )}
        </div>
        <NewProjectDialog />
      </div>
      {projects.length === 0 ? (
        <NoProjects />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => <li key={p.id}><ProjectCard project={p} /></li>)}
        </ul>
      )}
    </main>
  )
}
