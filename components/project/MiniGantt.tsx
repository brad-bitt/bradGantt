import { miniTimeline, type MiniTask } from '@/lib/gantt/mini'
import { daysBetween, durationDays, addDays } from '@/lib/gantt/dates'
import type { Range } from '@/lib/gantt/types'

const LANES = 4
const LANE_H = 8
const GAP = 3

/**
 * Vignette d'un projet dans sa carte : ses barres aux vraies couleurs, réduites à un bandeau.
 *
 * C'est la seule image du projet qu'on ait avant de l'ouvrir, et c'est ce qui distingue une
 * carte BradGantt d'une carte de liste de tâches. Décorative au sens de l'accessibilité
 * (`aria-hidden`) : les chiffres en dessous disent la même chose en mots.
 *
 * La plage est élargie d'un huitième de chaque côté pour que la première barre ne colle pas au
 * bord, et le trait du jour n'est tracé que s'il tombe dedans.
 */
export function MiniGantt({ tasks, range, today }: { tasks: MiniTask[]; range: Range; today: string }) {
  const pad = Math.max(1, Math.round(durationDays(range.start, range.end) / 8))
  const padded = { start: addDays(range.start, -pad), end: addDays(range.end, pad) }
  const bars = miniTimeline(tasks, padded, LANES)
  const span = durationDays(padded.start, padded.end)
  const todayLeft = today >= padded.start && today <= padded.end ? (daysBetween(padded.start, today) / span) * 100 : null
  const height = LANES * LANE_H + (LANES - 1) * GAP

  return (
    <div aria-hidden className="relative w-full overflow-hidden border-[3px] border-ink bg-cream" style={{ height: height + 12 }}>
      {/* Quatre bandes verticales : le rythme des mois du vrai diagramme, à l'échelle de la carte. */}
      <div className="absolute inset-0 flex">
        {[0, 1, 2, 3].map((i) => <span key={i} className={i % 2 === 1 ? 'flex-1 bg-band' : 'flex-1'} />)}
      </div>
      {todayLeft !== null && <span className="absolute inset-y-0 w-[2px] bg-today" style={{ left: `${todayLeft}%` }} />}
      {bars.map((b, i) =>
        b.milestone ? (
          <span
            key={i}
            className="absolute rotate-45 border-2 border-ink"
            style={{ left: `calc(${b.left}% - 4px)`, top: 6 + b.lane * (LANE_H + GAP) - 1, width: 8, height: 8, backgroundColor: b.color }}
          />
        ) : (
          <span
            key={i}
            className="absolute border-2 border-ink"
            style={{ left: `${b.left}%`, width: `${b.width}%`, top: 6 + b.lane * (LANE_H + GAP), height: LANE_H, backgroundColor: b.color }}
          />
        ),
      )}
    </div>
  )
}

/** Même gabarit qu'une vignette, mais vide : la carte d'un projet neuf garde la même silhouette. */
export function MiniGanttPlaceholder() {
  const height = LANES * LANE_H + (LANES - 1) * GAP
  return (
    <div
      aria-hidden
      className="flex w-full items-center justify-center border-[3px] border-dashed border-ink/30 font-mono text-[11px] uppercase tracking-wide text-ink-soft"
      style={{ height: height + 12 }}
    >
      Frise vide
    </div>
  )
}
