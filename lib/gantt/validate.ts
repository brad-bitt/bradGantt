import type { TaskType } from './types'

export interface TaskInput {
  title: string
  type: TaskType
  startDate: string
  endDate: string
  progress: number
}

export interface TaskErrors {
  title?: string
  dates?: string
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
  else if (end < input.startDate) errors.dates = 'La fin doit être après le début'
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true }
}
