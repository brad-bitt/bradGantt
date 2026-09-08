import type { Range, Task } from './types'
import { daysBetween, durationDays } from './dates'

export type MiniTask = Pick<Task, 'type' | 'startDate' | 'endDate' | 'color'>

export interface MiniBar {
  /** Abscisse et largeur en POURCENTAGE de la plage. */
  left: number
  width: number
  /** Couloir d'empilement, à partir de 0. */
  lane: number
  color: string
  milestone: boolean
}

/** Largeur plancher d'une barre, en pourcentage : sous ce seuil elle n'est plus qu'un trait. */
const MIN_WIDTH = 2

/**
 * Vignette d'un projet : ses tâches ramenées à des barres en pourcentage, empilées sur peu de
 * couloirs.
 *
 * Ce n'est pas la mise en page du vrai diagramme (qui suit l'ordre choisi par l'utilisateur, une
 * ligne par tâche) : une carte de la liste des projets n'a pas la hauteur pour ça. Les barres
 * sont donc rangées par date, et chaque nouvelle tâche prend le premier couloir libre à sa date
 * de début. Au-delà de `maxLanes`, elle rejoint le couloir qui se libère le plus tôt, quitte à
 * chevaucher : sur une vignette, un chevauchement se lit mieux qu'une hauteur qui varie d'une
 * carte à l'autre.
 *
 * Les groupes sont exclus : leurs dates stockées ne suivent pas leurs enfants (voir
 * `projectSummary`), et leurs enfants sont déjà là.
 */
export function miniTimeline(tasks: MiniTask[], range: Range, maxLanes = 4): MiniBar[] {
  const span = durationDays(range.start, range.end)
  if (span <= 0) return []
  const sorted = tasks
    .filter((t) => t.type !== 'group')
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate))

  // Date de fin du dernier occupant de chaque couloir.
  const laneEnds: string[] = []
  return sorted.map((t) => {
    let lane = laneEnds.findIndex((end) => end < t.startDate)
    if (lane === -1) {
      if (laneEnds.length < maxLanes) lane = laneEnds.length
      else lane = laneEnds.reduce((best, end, i) => (end < laneEnds[best] ? i : best), 0)
    }
    laneEnds[lane] = t.endDate
    return {
      left: round((daysBetween(range.start, t.startDate) / span) * 100),
      width: Math.max(MIN_WIDTH, round((durationDays(t.startDate, t.endDate) / span) * 100)),
      lane,
      color: t.color,
      milestone: t.type === 'milestone',
    }
  })
}

function round(n: number) {
  return Math.round(n * 100) / 100
}
