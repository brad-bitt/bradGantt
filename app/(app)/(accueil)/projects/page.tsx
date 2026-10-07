import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'
import { addDays, parseDate, todayISO } from '@/lib/gantt/dates'
import { projectSummary } from '@/lib/gantt/summary'
import { LATE_FILTER, visibleProjects } from '@/lib/projects/filter'
import { ProjectCard, type ProjectListItem, type CardTask } from '@/components/project/ProjectCard'
import { NewProjectDialog } from '@/components/project/NewProjectDialog'
import { NoProjects } from '@/components/project/NoProjects'
import { ProjectsSummaryLine } from '@/components/project/ProjectsSummaryLine'
import type { Member } from '@/lib/gantt/types'

/** Horizon des « jalons à venir » de la synthèse, en jours, aujourd'hui compris. */
const MILESTONE_HORIZON_DAYS = 14

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const { filtre } = await searchParams
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
  // La troisième lecture ne ramène que `project_id` : de quoi compter les tickets de chaque
  // carte, groupés ici même. Comme les tâches au-dessus, elle est plafonnée par le `max_rows` de
  // PostgREST (1000 lignes) : au-delà, les comptes seraient sous-estimés.
  const [tasksRes, membersRes, ticketsRes] = rows.length
    ? await Promise.all([
        supabase.from('tasks').select('project_id, type, title, start_date, end_date, progress, color'),
        supabase.from('memberships').select('project_id, user_id, role, profiles(display_name, email, avatar_url, color)'),
        supabase.from('tickets').select('project_id'),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }]

  // Un échec de ces lectures d'appoint ne doit PAS priver l'utilisateur de sa liste de projets :
  // les cartes se rendent alors sans chiffres ni avatars, ce qui reste un écran utilisable.
  // Politique d'erreur du projet : la cause technique part au journal serveur, l'écran reste muet.
  if (tasksRes.error) console.error('[projects] lecture "tasks" en échec :', tasksRes.error.message)
  if (membersRes.error) console.error('[projects] lecture "memberships" en échec :', membersRes.error.message)
  if (ticketsRes.error) console.error('[projects] lecture "tickets" en échec :', ticketsRes.error.message)
  const ticketCounts = new Map<string, number>()
  for (const t of ticketsRes.data ?? []) ticketCounts.set(t.project_id, (ticketCounts.get(t.project_id) ?? 0) + 1)
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
    // Lecture en échec : `null`, le lien reste sans chiffre plutôt que d'afficher un faux « 0 ».
    ticketCount: ticketsRes.error ? null : (ticketCounts.get(p.id) ?? 0),
    role: p.memberships[0].role,
    tasks: tasksByProject.get(p.id) ?? [],
    summary: projectSummary(tasksByProject.get(p.id) ?? [], today),
    members: membersByProject.get(p.id) ?? [],
    today,
  }))

  // Les chiffres portent sur TOUS les projets, filtre ou non : « 2 en retard » doit rester vrai
  // une fois le filtre posé, sinon le lien se contredirait.
  const allTasks = projects.flatMap((p) => p.tasks)
  const horizon = addDays(today, MILESTONE_HORIZON_DAYS - 1)
  const figures = {
    projects: projects.length,
    tasks: allTasks.filter((t) => t.type === 'task').length,
    upcomingMilestones: allTasks.filter((t) => t.type === 'milestone' && t.startDate >= today && t.startDate <= horizon).length,
    late: projects.reduce((n, p) => n + p.summary.lateCount, 0),
  }

  const lateOnly = filtre === LATE_FILTER
  const shown = visibleProjects(projects, filtre)

  return (
    <main className="mx-auto max-w-7xl p-4 space-y-6 sm:p-8 sm:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          {/* La date du jour en surtitre : c'est un tableau de bord, il dit quand on le regarde. */}
          <p className="font-mono text-xs text-ink-soft">
            {format(parseDate(today), 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
          <h1 className="text-4xl">Mes projets</h1>
          {/* Seulement avec au moins un projet : sur un compte neuf, une ligne de zéros ne dirait
              rien que la carte d'accueil ne dise mieux. */}
          {projects.length > 0 && <ProjectsSummaryLine figures={figures} lateOnly={lateOnly} />}
        </div>
        {/* Sur un compte vide, la carte d'accueil porte déjà « Nouveau projet » : deux boutons
            noirs pour un même geste, c'est ce que la règle des trois niveaux interdit. */}
        {projects.length > 0 && <NewProjectDialog />}
      </div>

      {projects.length === 0 ? (
        <NoProjects />
      ) : shown.length === 0 ? (
        // Le filtre ne garde rien : le dire, plutôt qu'une grille vide qui ferait croire que les
        // projets ont disparu. « Tout afficher » est juste au-dessus, dans la ligne de synthèse.
        <p className="text-sm text-ink-soft">Aucun projet en retard.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => <li key={p.id} className="min-w-0"><ProjectCard project={p} /></li>)}
        </ul>
      )}
    </main>
  )
}
