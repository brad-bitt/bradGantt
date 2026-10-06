/** Valeur de `?filtre=` qui restreint la liste aux projets en retard. */
export const LATE_FILTER = 'retard'

/**
 * Les projets à montrer pour un `?filtre=` donné. Une valeur inconnue est IGNORÉE plutôt que de
 * vider la page : une URL bricolée ou périmée ne doit pas faire croire que les projets ont disparu.
 */
export function visibleProjects<T extends { summary: { lateCount: number } }>(projects: T[], filtre: string | undefined): T[] {
  return filtre === LATE_FILTER ? projects.filter((p) => p.summary.lateCount > 0) : projects
}
