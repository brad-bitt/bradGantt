'use client'
import { useMemo } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useGanttStore } from '@/lib/gantt/store'
import { projectSummary } from '@/lib/gantt/summary'
import { parseDate } from '@/lib/gantt/dates'

function short(iso: string) {
  return format(parseDate(iso), 'd MMM yyyy', { locale: fr })
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-baseline gap-2">
      <span className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">{label}</span>
      <span className="font-bold text-sm">{children}</span>
    </div>
  )
}

/**
 * Barre de synthèse sous le diagramme.
 *
 * Elle occupe le bas de l'écran, que le diagramme laissait nu sur tout projet de quelques
 * lignes, et elle y met les chiffres qu'on allait autrement chercher en comptant les barres à
 * l'œil. Elle reste du DÉCOR au sens de la charte : encre douce pour les intitulés, aplat blanc,
 * aucune couleur de donnée — sauf le compteur de retard, qui est le seul signal à voir.
 */
export function GanttSummary() {
  const tasks = useGanttStore((s) => s.tasks)
  const today = useGanttStore((s) => s.today)
  const summary = useMemo(() => projectSummary(Object.values(tasks), today), [tasks, today])

  if (summary.taskCount === 0 && summary.milestoneCount === 0) return null

  return (
    <div
      data-testid="gantt-summary"
      className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t-[3px] border-ink bg-paper px-6 py-2"
    >
      <Stat label="Tâches">{summary.taskCount}</Stat>
      {summary.groupCount > 0 && <Stat label="Groupes">{summary.groupCount}</Stat>}
      {summary.milestoneCount > 0 && <Stat label="Jalons">{summary.milestoneCount}</Stat>}

      {summary.range && (
        <Stat label="Période">
          <span className="font-mono text-xs">
            {short(summary.range.start)} → {short(summary.range.end)}
          </span>
        </Stat>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">Avancement</span>
        {/* Barre de progression du projet. Hachures d'encre, comme l'avancement d'une tâche :
            c'est la même information, elle se lit avec le même vocabulaire. */}
        <span
          role="progressbar"
          aria-valuenow={summary.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avancement du projet"
          className="relative block h-4 w-24 border-[3px] border-ink bg-paper"
        >
          <span
            className="absolute inset-y-0 left-0 hatch opacity-40"
            style={{ width: `${summary.progress}%` }}
          />
        </span>
        <span className="font-bold text-sm">{summary.progress} %</span>
      </div>

      {summary.nextMilestone && (
        <Stat label="Prochain jalon">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="size-2 rotate-45 bg-ink" />
            {summary.nextMilestone.title}
            <span className="font-mono text-xs text-ink-soft">{short(summary.nextMilestone.date)}</span>
          </span>
        </Stat>
      )}

      {summary.lateCount > 0 && (
        // Sobre au repos comme toute alerte du projet : du texte rouge, jamais un aplat.
        <span className="ml-auto shrink-0 font-bold text-sm text-danger">
          {summary.lateCount} en retard
        </span>
      )}
    </div>
  )
}
