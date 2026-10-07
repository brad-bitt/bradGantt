import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LATE_FILTER } from '@/lib/projects/filter'

export interface SummaryFigures {
  projects: number
  tasks: number
  /** Jalons dans les quatorze prochains jours, aujourd'hui compris. */
  upcomingMilestones: number
  late: number
}

/** Singulier jusqu'à 1 inclus : « 0 tâche », comme on le dit en français. */
function n(count: number, one: string, many: string) {
  return (
    <span>
      <span className="font-mono font-bold text-ink">{count}</span> {count > 1 ? many : one}
    </span>
  )
}

// Les espaces sont dans le span : le texte se lit « 1 projet · 0 tâche » pour un lecteur d'écran
// et pour les tests, tandis que `aria-hidden` évite d'annoncer la ponctuation. À l'écran, un
// conteneur flex avale ces espaces de bord : c'est le `gap-x-2` de la ligne qui écarte le point.
const dot = <span aria-hidden> · </span>

/**
 * Une LIGNE sous le titre, à la place des quatre tuiles. Les tuiles pesaient autant que les
 * cartes de projet qu'elles résumaient ; une phrase se lit d'un coup d'œil et laisse la place
 * aux projets. Seul le retard est une commande : c'est le seul chiffre qui appelle un geste.
 */
export function ProjectsSummaryLine({ figures, lateOnly }: { figures: SummaryFigures; lateOnly: boolean }) {
  return (
    // `flex-wrap` : sur un téléphone, la phrase passe à la ligne au lieu d'élargir la page.
    <p data-testid="projects-summary" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-ink-soft">
      {n(figures.projects, 'projet', 'projets')}
      {dot}
      {n(figures.tasks, 'tâche', 'tâches')}
      {dot}
      {n(figures.upcomingMilestones, 'jalon sous 14 jours', 'jalons sous 14 jours')}
      {dot}
      {figures.late > 0 ? (
        <Link
          href={`/projects?filtre=${LATE_FILTER}`}
          aria-current={lateOnly ? 'page' : undefined}
          className={cn(
            'font-bold text-danger underline-offset-4 hover:underline brutal-focus',
            // Jaune = actif : le filtre posé se voit comme un segment sélectionné.
            lateOnly && 'bg-yellow px-1 text-on-data',
          )}
        >
          <span className="font-mono">{figures.late}</span> en retard
        </Link>
      ) : (
        <span><span className="font-mono font-bold text-ink">0</span> en retard</span>
      )}
      {lateOnly && (
        <Link href="/projects" className="ml-2 text-ink underline-offset-4 hover:underline brutal-focus">Tout afficher</Link>
      )}
    </p>
  )
}
