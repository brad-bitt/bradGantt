'use client'
import { useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useGanttStore } from '@/lib/gantt/store'
import { projectSummary } from '@/lib/gantt/summary'
import { parseDate } from '@/lib/gantt/dates'
import { cn } from '@/lib/utils'

function short(iso: string) {
  return format(parseDate(iso), 'd MMM yyyy', { locale: fr })
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-baseline gap-2">
      {/* Casse mixte, encre douce : l'intitulé s'efface devant le chiffre qu'il présente. */}
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="text-sm font-bold">{children}</span>
    </div>
  )
}

/**
 * Barre de synthèse sous le diagramme : les chiffres qu'on allait autrement chercher en comptant
 * les barres à l'œil. Elle reste du DÉCOR (encre douce, aplat blanc), sauf le retard — le seul
 * signal à voir, et la seule commande : il allume la mise en évidence des barres en retard.
 */
export function GanttSummary() {
  const tasks = useGanttStore((s) => s.tasks)
  const today = useGanttStore((s) => s.today)
  const highlightLate = useGanttStore((s) => s.highlightLate)
  const toggleHighlightLate = useGanttStore((s) => s.toggleHighlightLate)
  const setHighlightLate = useGanttStore((s) => s.setHighlightLate)
  const summary = useMemo(() => projectSummary(Object.values(tasks), today), [tasks, today])

  // La barre est masquée sous 640 px de large ou 500 px de haut (téléphone, fenêtre réduite) :
  // avec elle disparaît le seul bouton qui éteint la mise en évidence, et un appareil tactile n'a
  // pas d'Échap. On l'éteint donc quand la barre cesse d'être visible. Doit rester aligné sur
  // `hidden sm:flex short:hidden` ci-dessous.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const visible = window.matchMedia('(min-width: 40rem) and (min-height: 501px)')
    const onChange = () => { if (!visible.matches) setHighlightLate(false) }
    onChange()
    visible.addEventListener('change', onChange)
    return () => visible.removeEventListener('change', onChange)
  }, [setHighlightLate])

  if (summary.taskCount === 0 && summary.milestoneCount === 0) return null

  return (
    <div
      data-testid="gantt-summary"
      // `hidden sm:flex` : sur un téléphone, la barre repliée sur quatre lignes mangeait le tiers de
      // la hauteur ; la carte du projet dans la liste porte déjà ces chiffres.
      className="hidden shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t-[3px] border-ink bg-paper px-6 py-2 sm:flex short:hidden"
    >
      <Stat label="Tâches"><span className="font-mono">{summary.taskCount}</span></Stat>
      {summary.groupCount > 0 && <Stat label="Groupes"><span className="font-mono">{summary.groupCount}</span></Stat>}
      {summary.milestoneCount > 0 && <Stat label="Jalons"><span className="font-mono">{summary.milestoneCount}</span></Stat>}

      {summary.range && (
        <Stat label="Période">
          <span className="font-mono text-xs">{short(summary.range.start)} → {short(summary.range.end)}</span>
        </Stat>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm text-ink-soft">Avancement</span>
        {/* Hachures d'encre, comme l'avancement d'une tâche : même information, même vocabulaire. */}
        <span
          role="progressbar"
          aria-valuenow={summary.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avancement du projet"
          className="relative block h-4 w-24 border-[3px] border-ink bg-paper"
        >
          <span className="absolute inset-y-0 left-0 hatch opacity-40" style={{ width: `${summary.progress}%` }} />
        </span>
        <span className="font-mono text-sm font-bold">{summary.progress} %</span>
      </div>

      {summary.nextMilestone && (
        <Stat label="Prochain jalon">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="size-2 rotate-45 bg-ink" />
            {summary.nextMilestone.title}
            <span className="font-mono text-xs font-normal text-ink-soft">{short(summary.nextMilestone.date)}</span>
          </span>
        </Stat>
      )}

      {summary.lateCount > 0 && (
        // Niveau 3 au repos (texte rouge, jamais un aplat) ; jaune quand la mise en évidence est
        // allumée — le jaune dit « actif ». Un second clic ou Échap l'éteint.
        <button
          type="button"
          aria-pressed={highlightLate}
          onClick={toggleHighlightLate}
          title={highlightLate ? 'Ne plus distinguer le retard (Échap)' : 'Distinguer les tâches en retard'}
          className={cn(
            'ml-auto shrink-0 border-[3px] px-2 py-0.5 text-sm font-bold brutal-focus',
            highlightLate ? 'border-ink bg-yellow text-on-data' : 'border-transparent text-danger underline-offset-4 hover:underline',
          )}
        >
          <span className="font-mono">{summary.lateCount}</span> en retard
        </button>
      )}
    </div>
  )
}
