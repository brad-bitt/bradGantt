/** Contraintes `tickets` en base : `char_length(trim(title)) between 1 and 200`, description ≤ 5000. */
export const TITLE_MAX_LENGTH = 200
export const DESCRIPTION_MAX_LENGTH = 5000

export interface TicketInput {
  title: string
  description: string
}

export interface TicketErrors {
  title?: string
  description?: string
}

/**
 * Validation du formulaire de ticket. Pure et sans dépendance au store : c'est elle qui
 * produit les messages INLINE de la politique d'erreur du projet (un échec de persistance,
 * lui, part en toast depuis les commandes).
 *
 * Les bornes reprennent EXACTEMENT les contraintes SQL, `trim` compris pour le titre : une
 * validation plus permissive ferait remonter une erreur Postgres brute là où l'utilisateur
 * attend un message sous son champ.
 */
export function validateTicketInput(input: TicketInput): { ok: true } | { ok: false; errors: TicketErrors } {
  const errors: TicketErrors = {}
  const title = input.title.trim()
  if (title.length === 0) errors.title = 'Le titre est requis'
  else if (title.length > TITLE_MAX_LENGTH) errors.title = `Le titre ne peut pas dépasser ${TITLE_MAX_LENGTH} caractères`
  if (input.description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `La description ne peut pas dépasser ${DESCRIPTION_MAX_LENGTH} caractères`
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true }
}
