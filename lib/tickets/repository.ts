import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesUpdate } from '@/lib/supabase/types'
import type { Ticket, TicketPatch, TicketStatus } from './types'

/** Ce qu'on envoie pour créer. Ni `id` ni `number` : les deux viennent du serveur. */
export interface TicketInsert {
  projectId: string
  title: string
  description: string
  status: TicketStatus
  assigneeId: string | null
  taskId: string | null
}

export interface TicketRepository {
  /** Rend le ticket TEL QU'IL EST EN BASE, numéro compris. */
  insertTicket(input: TicketInsert): Promise<Ticket>
  updateTicket(ticketId: string, patch: TicketPatch): Promise<void>
  deleteTicket(ticketId: string): Promise<void>
}

export function rowToTicket(row: Tables<'tickets'>): Ticket {
  return {
    id: row.id,
    projectId: row.project_id,
    number: row.number,
    title: row.title,
    description: row.description,
    status: row.status,
    assigneeId: row.assignee_id,
    taskId: row.task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Colonnes RÉINSCRIPTIBLES, et elles seules. `number` est figé par le trigger
 * tickets_number_immutable, `updated_at` est posé par `set_updated_at`, `created_at` et
 * `project_id` n'ont aucune raison de changer : les envoyer ferait au mieux du bruit, au pire
 * échouer l'écriture.
 */
const COLUMN: { [K in keyof Ticket]?: keyof TablesUpdate<'tickets'> } = {
  title: 'title',
  description: 'description',
  status: 'status',
  assigneeId: 'assignee_id',
  taskId: 'task_id',
}

export function patchToRow(patch: TicketPatch): TablesUpdate<'tickets'> {
  const row: Record<string, unknown> = {}
  for (const [key, col] of Object.entries(COLUMN) as [keyof Ticket, string][]) {
    // `key in patch` et non une simple vérité : `null` sur l'assigné ou la tâche est une
    // valeur à écrire (« détacher »), pas une absence.
    if (key in patch && patch[key as keyof TicketPatch] !== undefined) row[col] = patch[key as keyof TicketPatch]
  }
  return row as TablesUpdate<'tickets'>
}

export function createSupabaseTicketRepository(client: SupabaseClient<Database>): TicketRepository {
  // Même formulation fermée que le dépôt du Gantt : `.eq('id', …)` cible au plus une ligne,
  // `count` doit donc valoir exactement 1. Rejeter tout le reste est indispensable —
  // `count === 0` laisserait passer un `count` null (en-tête content-range absente) comme un
  // faux succès alors que la RLS a refusé l'écriture en silence.
  const check = (error: { message: string } | null, count?: number | null) => {
    if (error) throw new Error(error.message)
    if (count !== undefined && count !== 1) throw new Error('no_row_affected')
  }
  return {
    async insertTicket(input) {
      // `.select().single()` : le NUMÉRO est attribué côté serveur par un trigger. On relit
      // donc la ligne créée plutôt que d'inventer une valeur qu'il faudrait corriger ensuite.
      const { data, error } = await client
        .from('tickets')
        .insert({
          project_id: input.projectId,
          // Les types générés exigent `number` (colonne not null) alors que le trigger
          // tickets_assign_number l'écrase toujours : cette valeur n'est jamais conservée.
          number: 0,
          title: input.title,
          description: input.description,
          status: input.status,
          assignee_id: input.assigneeId,
          task_id: input.taskId,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return rowToTicket(data)
    },
    async updateTicket(ticketId, patch) {
      const { error, count } = await client.from('tickets').update(patchToRow(patch), { count: 'exact' }).eq('id', ticketId)
      check(error, count)
    },
    async deleteTicket(ticketId) {
      const { error, count } = await client.from('tickets').delete({ count: 'exact' }).eq('id', ticketId)
      check(error, count)
    },
  }
}
