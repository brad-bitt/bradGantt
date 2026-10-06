import type { BadgeColor } from '@/components/ui/Badge'

export type TicketStatus = 'todo' | 'doing' | 'done'

/** Ordre des colonnes du kanban, et ordre de déplacement des flèches d'une carte. */
export const STATUS_ORDER = ['todo', 'doing', 'done'] as const satisfies readonly TicketStatus[]

export const STATUS_LABELS: Record<TicketStatus, string> = {
  todo: 'À faire',
  doing: 'En cours',
  done: 'Terminé',
}

/**
 * Couleur du badge de chaque statut. Vit ici plutôt que dans un composant : la vue liste et
 * l'éditeur de tâche du Gantt l'affichent tous les deux, et deux tables jumelles finiraient
 * par diverger. L'import est un import de TYPE seul, aucun composant n'est tiré dans `lib`.
 */
export const TICKET_STATUS_BADGE: Record<TicketStatus, BadgeColor> = {
  todo: 'ink',
  doing: 'blue',
  done: 'emerald',
}

export interface Ticket {
  id: string
  projectId: string
  /** Attribué par le SERVEUR (trigger tickets_assign_number), jamais par le client. */
  number: number
  title: string
  description: string
  status: TicketStatus
  assigneeId: string | null
  /** Tâche du Gantt à laquelle ce ticket est rattaché. `null` = ticket libre. */
  taskId: string | null
  createdAt: string
  updatedAt: string
}

/** `number` exclu : il est figé en base par le trigger tickets_number_immutable. */
export type TicketPatch = Partial<Omit<Ticket, 'id' | 'projectId' | 'number'>>

/** Ce que le GANTT sait d'un ticket : de quoi compter et lister, rien de plus. */
export interface TicketSummary {
  id: string
  number: number
  title: string
  status: TicketStatus
}

/** Une tâche telle qu'elle apparaît dans le sélecteur de rattachement. */
export interface TicketTaskOption {
  id: string
  title: string
}

/**
 * Filtres de la vue liste. `'all'` plutôt que `null` : ce sont les valeurs d'un `<select>`,
 * et une chaîne vide y désigne déjà « aucun assigné » / « aucune tâche ».
 */
export interface TicketFilters {
  status: TicketStatus | 'all'
  assigneeId: string
  taskId: string
}

export const NO_FILTERS: TicketFilters = { status: 'all', assigneeId: 'all', taskId: 'all' }

export type TicketEditorState =
  | { mode: 'edit'; ticketId: string }
  /** `taskId` pré-remplit le rattachement : c'est le chemin « + Ticket » depuis l'éditeur de tâche du Gantt. */
  | { mode: 'create'; taskId: string | null }
  | null

/** Geste de glisser-déposer en cours sur le kanban. `overStatus` est la colonne survolée. */
export type TicketDragState = { ticketId: string; overStatus: TicketStatus } | null
