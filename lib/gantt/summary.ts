import type { Range, Task } from './types'
import { durationDays, maxDate, minDate } from './dates'

/**
 * Le strict nécessaire au calcul. La liste de projets ne charge pas des tâches entières pour
 * afficher trois chiffres par carte : elle ne lit que ces cinq colonnes, et un `Task` complet
 * reste assignable ici.
 */
export type SummaryTask = Pick<Task, 'type' | 'title' | 'startDate' | 'endDate' | 'progress'>

export interface ProjectSummary {
  taskCount: number
  milestoneCount: number
  groupCount: number
  /** Empan réel du projet, `null` tant qu'il ne contient ni tâche ni jalon. */
  range: Range | null
  /** 0 à 100, pondéré par la durée des tâches. */
  progress: number
  nextMilestone: { title: string; date: string } | null
  /** Tâches inachevées dont la fin est déjà passée. */
  lateCount: number
}

const EMPTY: ProjectSummary = {
  taskCount: 0,
  milestoneCount: 0,
  groupCount: 0,
  range: null,
  progress: 0,
  nextMilestone: null,
  lateCount: 0,
}

/**
 * Une tâche en retard : une TÂCHE (un jalon n'a pas d'avancement, un groupe pas de dates
 * propres), inachevée, dont la fin est passée. Une tâche qui finit AUJOURD'HUI n'est pas en
 * retard : la journée n'est pas écoulée. Partagée par la synthèse et par la mise en évidence
 * du Gantt : les deux doivent compter les mêmes barres.
 */
export function isLate(t: SummaryTask, today: string): boolean {
  return t.type === 'task' && t.progress < 100 && t.endDate < today
}

/**
 * Chiffres de tête d'un projet, calculés pour la barre de synthèse sous le diagramme.
 *
 * Les GROUPES sont exclus de tous les calculs de dates et d'avancement : leurs colonnes
 * `start_date` / `end_date` ne sont jamais réécrites quand leurs enfants bougent (c'est
 * `computeLayout` qui recalcule leur empan à l'affichage), et leur `progress` vaut toujours 0.
 * Les inclure ferait mentir la période comme l'avancement.
 *
 * L'avancement est pondéré par la DURÉE et non par le nombre de tâches : une tâche d'un jour
 * terminée et une tâche de trois semaines à peine commencée ne valent pas un demi-projet fait.
 */
export function projectSummary(tasks: SummaryTask[], today: string): ProjectSummary {
  if (tasks.length === 0) return EMPTY

  const real = tasks.filter((t) => t.type !== 'group')
  const plain = real.filter((t) => t.type === 'task')

  let range: Range | null = null
  for (const t of real) {
    range = range === null
      ? { start: t.startDate, end: t.endDate }
      : { start: minDate(range.start, t.startDate), end: maxDate(range.end, t.endDate) }
  }

  let weighted = 0
  let totalDays = 0
  for (const t of plain) {
    const days = durationDays(t.startDate, t.endDate)
    weighted += days * t.progress
    totalDays += days
  }

  const upcoming = real
    .filter((t) => t.type === 'milestone' && t.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]

  return {
    taskCount: plain.length,
    milestoneCount: real.length - plain.length,
    groupCount: tasks.length - real.length,
    range,
    // Arrondi seulement à la fin : arrondir chaque tâche ferait dériver le total.
    progress: totalDays > 0 ? Math.round(weighted / totalDays) : 0,
    nextMilestone: upcoming ? { title: upcoming.title, date: upcoming.startDate } : null,
    lateCount: plain.filter((t) => isLate(t, today)).length,
  }
}
