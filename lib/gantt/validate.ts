import type { TaskType } from './types'

export interface TaskInput {
  title: string
  type: TaskType
  startDate: string
  endDate: string
  /**
   * Saisie BRUTE du champ, pas un nombre déjà converti. `Number('')` vaut 0 : convertir avant
   * de valider faisait écrire un avancement de 0 % en base dès que l'utilisateur vidait le
   * champ pour le retaper, sans le moindre message. C'est ici que le vide et le non-numérique
   * doivent être refusés.
   */
  progress: string
}

export interface TaskErrors {
  title?: string
  dates?: string
  progress?: string
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Validation du formulaire d'édition d'une tâche. Pure et sans dépendance au store : c'est
 * elle qui produit les messages INLINE de la politique d'erreur du projet (une erreur de
 * persistance, elle, part en toast depuis les commandes).
 *
 * Le cas du jalon est particulier : il n'occupe qu'un jour, l'éditeur masque son champ « Fin »
 * et enverra `endDate = startDate`. Valider la valeur résiduelle du champ masqué ferait
 * refuser un jalon parfaitement légitime (typiquement après être passé de « tâche » à
 * « jalon » avec une fin antérieure encore en état).
 */
export function validateTaskInput(input: TaskInput): { ok: true } | { ok: false; errors: TaskErrors } {
  const errors: TaskErrors = {}
  if (input.title.trim().length === 0) errors.title = 'Le titre est requis'
  const end = input.type === 'milestone' ? input.startDate : input.endDate
  if (!ISO_RE.test(input.startDate) || !ISO_RE.test(end)) errors.dates = 'Dates invalides'
  // « après » serait faux : une tâche d'un seul jour (fin = début) est légitime et acceptée.
  else if (end < input.startDate) errors.dates = 'La fin ne peut pas précéder le début'
  // Seule une tâche porte un avancement ; groupe et jalon sont normalisés à 0 par l'éditeur,
  // et leur champ n'est pas affiché — valider sa valeur résiduelle refuserait une saisie valide.
  if (input.type === 'task') {
    const value = Number(input.progress)
    if (input.progress.trim() === '' || !Number.isFinite(value) || value < 0 || value > 100) {
      errors.progress = 'L\'avancement doit être un nombre entre 0 et 100'
    }
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true }
}
