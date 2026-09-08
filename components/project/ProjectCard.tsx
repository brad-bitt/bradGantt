'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, type BadgeColor } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RenameProjectDialog } from './RenameProjectDialog'
import { MiniGantt, MiniGanttPlaceholder } from './MiniGantt'
import { deleteProject } from '@/app/(app)/projects/actions'
import { toast } from '@/lib/toast/store'
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
  tasks: CardTask[]
  summary: ProjectSummary
  members: Member[]
  today: string
}

const roleColor: Record<ProjectListItem['role'], BadgeColor> = { owner: 'violet', editor: 'blue', viewer: 'cyan' }

/** Trois avatars au plus, puis un compteur : au-delà, la pile déborde de la carte. */
const MAX_AVATARS = 3

function short(iso: string) {
  return format(parseDate(iso), 'd MMM yyyy', { locale: fr })
}

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const [renaming, setRenaming] = useState(false)
  const [, start] = useTransition()
  const { summary, members, tasks, today } = project
  const empty = summary.taskCount === 0 && summary.milestoneCount === 0
  /**
   * Seuls les compteurs NON NULS sont énoncés : « 0 tâche · 1 jalon » se lisait comme un
   * défaut de calcul sur un projet qui ne contient qu'un jalon, alors qu'il est simplement
   * fait de jalons.
   */
  const counts = [
    summary.taskCount > 0 && `${summary.taskCount} tâche${summary.taskCount > 1 ? 's' : ''}`,
    summary.groupCount > 0 && `${summary.groupCount} groupe${summary.groupCount > 1 ? 's' : ''}`,
    summary.milestoneCount > 0 && `${summary.milestoneCount} jalon${summary.milestoneCount > 1 ? 's' : ''}`,
  ].filter((x): x is string => typeof x === 'string')

  function remove() {
    if (!window.confirm(`Supprimer « ${project.name} » et toutes ses tâches ?`)) return
    start(async () => {
      const res = await deleteProject(project.id)
      if (res.error) toast.error(res.error)
    })
  }

  return (
    <article aria-label={project.name} className="flex h-full flex-col gap-3 bg-paper brutal p-4 transition-shadow hover:shadow-brutal-lg">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/projects/${project.id}`} className="font-display text-xl uppercase leading-tight brutal-focus">{project.name}</Link>
        <Badge color={roleColor[project.role]}>{project.role}</Badge>
      </div>

      {/* La vignette d'abord : c'est l'image du projet, elle se reconnaît avant de se lire. Un
          projet vide garde la même silhouette avec un cadre en pointillé. */}
      {empty || !summary.range ? (
        <MiniGanttPlaceholder />
      ) : (
        <Link href={`/projects/${project.id}`} tabIndex={-1} aria-hidden className="block brutal-focus">
          <MiniGantt tasks={tasks} range={summary.range} today={today} />
        </Link>
      )}

      {empty ? (
        // Un projet vide ne se décrit pas par des zéros : la carte dit ce qu'il reste à faire.
        <p className="flex-1 font-mono text-xs text-ink-soft">Aucune tâche — ouvre-le pour commencer.</p>
      ) : (
        <div className="flex-1 space-y-2">
          {/* Deux lignes et non une : côte à côte, « 2 tâches · 1 groupe · 1 jalon » et la période
              se coupaient en plein milieu d'un compteur dès que la carte était un peu étroite. */}
          <p className="font-mono text-xs text-ink-soft">{counts.join(' · ')}</p>
          {summary.range && (
            <p className="font-mono text-xs text-ink-soft">{short(summary.range.start)} → {short(summary.range.end)}</p>
          )}

          {/* Pas de barre d'avancement sans tâche à faire avancer : sur un projet qui ne contient
              que des jalons, « 0 % » décrivait un retard imaginaire. */}
          {summary.taskCount > 0 && (
            <div className="flex items-center gap-2">
              {/* Même vocabulaire que l'avancement d'une barre de tâche : des hachures d'encre. */}
              <div
                role="progressbar"
                aria-valuenow={summary.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Avancement de ${project.name}`}
                className="relative h-3 flex-1 border-[3px] border-ink bg-paper"
              >
                <span
                  className="absolute inset-y-0 left-0 hatch opacity-40"
                  style={{ width: `${summary.progress}%` }}
                />
              </div>
              <span className="w-10 text-right font-mono text-xs font-bold">{summary.progress} %</span>
            </div>
          )}

          {summary.nextMilestone && (
            <p className="flex items-center gap-2 text-sm font-bold">
              <span aria-hidden className="size-2 shrink-0 rotate-45 bg-ink" />
              <span className="truncate">{summary.nextMilestone.title}</span>
              <span className="ml-auto shrink-0 font-mono text-xs font-normal text-ink-soft">{short(summary.nextMilestone.date)}</span>
            </p>
          )}

          {summary.lateCount > 0 && (
            // Sobre au repos, comme toute alerte du projet : du texte rouge, jamais un aplat.
            <p className="text-sm font-bold text-danger">{summary.lateCount} en retard</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t-[3px] border-ink pt-3">
        <span className="flex -space-x-2">
          {members.slice(0, MAX_AVATARS).map((m) => (
            <Avatar key={m.userId} name={m.displayName} color={m.color} src={m.avatarUrl} size="sm" />
          ))}
          {members.length > MAX_AVATARS && (
            <span className="ml-3 self-center font-mono text-xs text-ink-soft">+{members.length - MAX_AVATARS}</span>
          )}
        </span>
        {project.role === 'owner' && (
          <span className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setRenaming(true)}>Renommer</Button>
            <Button size="sm" variant="danger-quiet" onClick={remove}>Supprimer</Button>
          </span>
        )}
      </div>

      {renaming && <RenameProjectDialog projectId={project.id} currentName={project.name} open onClose={() => setRenaming(false)} />}
    </article>
  )
}
