import { cn } from '@/lib/utils'

export interface OverviewFigures {
  projects: number
  tasks: number
  /** Tâches à 100 %. */
  done: number
  /** Jalons dans les quatorze prochains jours, aujourd'hui compris. */
  upcomingMilestones: number
  late: number
}

function Tile({ label, value, hint, alert }: { label: string; value: number; hint?: string; alert?: boolean }) {
  return (
    <div className="flex flex-col gap-1 bg-paper brutal px-4 py-3">
      <span className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">{label}</span>
      {/* Chiffre en caractères d'affichage : c'est LA donnée de la tuile, elle a droit au noir
          plein. Le retard passe en rouge seulement s'il existe — au repos, il n'y a rien à voir. */}
      <span className={cn('font-display text-3xl leading-none', alert && value > 0 && 'text-danger')}>{value}</span>
      {hint && <span className="font-mono text-xs text-ink-soft">{hint}</span>}
    </div>
  )
}

/**
 * Bandeau de tête de la liste des projets : quatre chiffres qui résument tout ce qu'on possède,
 * avant même de lire une carte. Le bandeau n'apparaît qu'avec au moins un projet — sur un compte
 * neuf, quatre zéros ne diraient rien que la carte d'accueil ne dise mieux.
 */
export function ProjectsOverview({ figures }: { figures: OverviewFigures }) {
  return (
    <div data-testid="projects-overview" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Tile label="Projets" value={figures.projects} />
      <Tile
        label="Tâches"
        value={figures.tasks}
        hint={figures.tasks > 0 ? `${figures.done} terminée${figures.done > 1 ? 's' : ''}` : undefined}
      />
      <Tile label="Jalons sous 14 jours" value={figures.upcomingMilestones} />
      <Tile label="En retard" value={figures.late} alert />
    </div>
  )
}
