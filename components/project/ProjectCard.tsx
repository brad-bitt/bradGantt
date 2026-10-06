import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { MiniGantt, MiniGanttPlaceholder } from './MiniGantt'
import { ProjectMenu } from './ProjectMenu'
import { ROLE_BADGE, ROLE_LABELS } from '@/lib/projects/roles'
import { parseDate } from '@/lib/gantt/dates'
import type { ProjectSummary, SummaryTask } from '@/lib/gantt/summary'
import type { MiniTask } from '@/lib/gantt/mini'
import type { Member } from '@/lib/gantt/types'

/** Ce que la carte sait d'une tâche : de quoi la résumer ET la dessiner en vignette. */
export type CardTask = SummaryTask & MiniTask

export interface ProjectListItem {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
  createdAt: string
  ticketsEnabled: boolean
  /** `null` : la lecture des tickets a échoué ; le lien s'affiche, sans chiffre. */
  ticketCount: number | null
  tasks: CardTask[]
  summary: ProjectSummary
  members: Member[]
  today: string
}

/** Trois avatars au plus, puis un compteur : au-delà, la pile déborde de la carte. */
const MAX_AVATARS = 3

function short(iso: string) {
  return format(parseDate(iso), 'd MMM yyyy', { locale: fr })
}

/**
 * Carte d'un projet. TOUTE la carte ouvre le Gantt : le titre est le lien, et son pseudo-élément
 * `after:` la couvre entière — un seul arrêt de tabulation, un seul nom annoncé, et un clic
 * n'importe où mène au projet. `after:z-[1]` le place au-dessus de la vignette et de la barre
 * d'avancement (`relative`, plus loin dans le DOM) ; ce qui doit rester cliquable pour soi
 * (le menu, le lien Tickets) est posé AU-DESSUS, en `relative z-10`.
 */
export function ProjectCard({ project }: { project: ProjectListItem }) {
  const { summary, members, tasks, today } = project
  const base = `/projects/${project.id}`
  const empty = summary.taskCount === 0 && summary.milestoneCount === 0
  /**
   * Seuls les compteurs NON NULS sont énoncés : « 0 tâche · 1 jalon » se lisait comme un
   * défaut de calcul sur un projet qui ne contient qu'un jalon.
   */
  const counts = [
    summary.taskCount > 0 && `${summary.taskCount} tâche${summary.taskCount > 1 ? 's' : ''}`,
    summary.groupCount > 0 && `${summary.groupCount} groupe${summary.groupCount > 1 ? 's' : ''}`,
    summary.milestoneCount > 0 && `${summary.milestoneCount} jalon${summary.milestoneCount > 1 ? 's' : ''}`,
  ].filter((x): x is string => typeof x === 'string')

  return (
    <article
      aria-label={project.name}
      className={
        'group/card relative flex h-full cursor-pointer flex-col gap-3 bg-paper brutal p-4 outline-offset-2 transition-shadow ' +
        // Liseré jaune au survol et au focus du lien : le jaune dit « c'est ceci que tu vises ».
        'hover:shadow-brutal-lg hover:outline-[3px] hover:outline-yellow ' +
        'has-[[data-card-link]:focus-visible]:outline-[3px] has-[[data-card-link]:focus-visible]:outline-yellow'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={base}
          data-card-link
          className="font-display text-xl uppercase leading-tight outline-none after:absolute after:inset-0 after:z-[1] after:content-['']"
        >
          {project.name}
        </Link>
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          <Badge color={ROLE_BADGE[project.role]}>{ROLE_LABELS[project.role]}</Badge>
          {project.role === 'owner' && (
            <ProjectMenu
              projectId={project.id}
              projectName={project.name}
              ticketsEnabled={project.ticketsEnabled}
              // Révélé au survol de la carte, au focus, menu ouvert, et toujours au doigt.
              triggerClassName="opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 touch:opacity-100"
            />
          )}
        </div>
      </div>

      {/* La vignette d'abord : c'est l'image du projet, elle se reconnaît avant de se lire. */}
      {empty || !summary.range ? <MiniGanttPlaceholder /> : <MiniGantt tasks={tasks} range={summary.range} today={today} />}

      {empty ? (
        // Un projet vide ne se décrit pas par des zéros : la carte dit ce qu'il reste à faire.
        <p className="flex-1 text-xs text-ink-soft">Ouvre-le pour poser la première tâche.</p>
      ) : (
        <div className="flex-1 space-y-2">
          <p className="font-mono text-xs text-ink-soft">{counts.join(' · ')}</p>
          {summary.range && (
            <p className="font-mono text-xs text-ink-soft">{short(summary.range.start)} → {short(summary.range.end)}</p>
          )}
          {/* Pas de barre d'avancement sans tâche à faire avancer : sur un projet qui ne contient
              que des jalons, « 0 % » décrivait un retard imaginaire. */}
          {summary.taskCount > 0 && (
            <div className="flex items-center gap-2">
              <div
                role="progressbar"
                aria-valuenow={summary.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Avancement de ${project.name}`}
                className="relative h-3 flex-1 border-[3px] border-ink bg-paper"
              >
                <span className="absolute inset-y-0 left-0 hatch opacity-40" style={{ width: `${summary.progress}%` }} />
              </div>
              <span className="w-10 text-right font-mono text-xs font-bold">{summary.progress} %</span>
            </div>
          )}
          {summary.lateCount > 0 && (
            // Sobre au repos, comme toute alerte du projet : du texte rouge, jamais un aplat.
            <p className="text-sm font-bold text-danger"><span className="font-mono">{summary.lateCount}</span> en retard</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-[3px] border-ink pt-3">
        <span className="flex -space-x-2">
          {members.slice(0, MAX_AVATARS).map((m) => (
            <Avatar key={m.userId} name={m.displayName} color={m.color} src={m.avatarUrl} size="sm" />
          ))}
          {members.length > MAX_AVATARS && (
            <span className="ml-3 self-center font-mono text-xs text-ink-soft">+{members.length - MAX_AVATARS}</span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-3 text-sm">
          {summary.nextMilestone && (
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="size-2 shrink-0 rotate-45 bg-ink" />
              <span className="truncate font-bold">{summary.nextMilestone.title}</span>
              <span className="shrink-0 font-mono text-xs text-ink-soft">{short(summary.nextMilestone.date)}</span>
            </span>
          )}
          {project.ticketsEnabled && (
            // Niveau 3 : un lien discret, au-dessus du lien de la carte pour mener au kanban.
            <Link href={`${base}/tickets`} className="relative z-10 shrink-0 text-ink-soft underline-offset-4 hover:text-ink hover:underline brutal-focus">
              Tickets{project.ticketCount !== null && <> · <span className="font-mono">{project.ticketCount}</span></>}
            </Link>
          )}
        </span>
      </div>
    </article>
  )
}
