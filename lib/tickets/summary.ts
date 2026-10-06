import type { Ticket, TicketFilters, TicketStatus, TicketSummary } from './types'

/** Ticket résumé tel qu'il sort de la lecture serveur du Gantt : le résumé, plus sa tâche. */
export interface TicketRowSummary extends TicketSummary {
  taskId: string | null
}

/**
 * Tri de TOUTES les vues : par numéro croissant, c'est-à-dire par ordre de création. Un ordre
 * manuel dans une colonne du kanban n'existe pas — le numéro est le seul rang, et il ne bouge
 * jamais (le trigger tickets_number_immutable le fige).
 */
export function byNumber(a: Ticket, b: Ticket): number {
  return a.number - b.number
}

/**
 * `'all'` laisse tout passer. La CHAÎNE VIDE, elle, est une valeur significative : elle
 * désigne « aucun assigné » ou « ticket libre ». Confondre les deux rendrait ces deux
 * filtres-là inatteignables depuis un `<select>`.
 */
export function filterTickets(tickets: Ticket[], filters: TicketFilters): Ticket[] {
  return tickets
    .filter((t) => {
      if (filters.status !== 'all' && t.status !== filters.status) return false
      if (filters.assigneeId !== 'all' && (t.assigneeId ?? '') !== filters.assigneeId) return false
      if (filters.taskId !== 'all' && (t.taskId ?? '') !== filters.taskId) return false
      return true
    })
    // Copie implicite : `filter` rend un nouveau tableau, `sort` ne touche donc pas l'entrée.
    .sort(byNumber)
}

/** Les trois colonnes du kanban, toujours présentes même vides : une colonne qui disparaît décalerait les deux autres. */
export function ticketsByStatus(tickets: Ticket[]): Record<TicketStatus, Ticket[]> {
  const out: Record<TicketStatus, Ticket[]> = { todo: [], doing: [], done: [] }
  for (const t of [...tickets].sort(byNumber)) out[t.status].push(t)
  return out
}

/** Regroupement destiné au GANTT. Les tickets libres n'y ont pas de place : aucune ligne ne les porterait. */
export function groupByTask(rows: TicketRowSummary[]): Record<string, TicketSummary[]> {
  const out: Record<string, TicketSummary[]> = {}
  for (const r of rows) {
    if (!r.taskId) continue
    const list = out[r.taskId] ?? []
    list.push({ id: r.id, number: r.number, title: r.title, status: r.status })
    out[r.taskId] = list
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.number - b.number)
  return out
}

export function countDone(summaries: TicketSummary[]): { done: number; total: number } {
  return { done: summaries.filter((s) => s.status === 'done').length, total: summaries.length }
}
