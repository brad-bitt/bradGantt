import type { TicketStatus } from '@/lib/tickets/types'

/**
 * Aplat de chaque statut : pastille de colonne, bande d'accent de la carte et de la fenêtre de
 * ticket. Mêmes teintes que les badges de la liste (`TICKET_STATUS_BADGE`) : un statut garde sa
 * couleur d'une vue à l'autre. Couleurs de DONNÉES, identiques dans les deux thèmes.
 */
export const STATUS_SWATCH: Record<TicketStatus, string> = {
  todo: 'bg-paper',
  doing: 'bg-blue',
  done: 'bg-emerald',
}
