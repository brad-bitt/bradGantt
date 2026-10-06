import type { StoreApi } from 'zustand'
import { createRunner } from '@/lib/optimistic/run'
import type { TicketsState } from './store'
import type { TicketRepository } from './repository'
import type { TicketEvent } from './events'
import type { Ticket, TicketPatch, TicketStatus } from './types'

export const PERSIST_ERROR = 'Modification non enregistrée'
export const UNKNOWN_TICKET_ERROR = 'Ticket introuvable'

export interface CreateTicketInput {
  title: string
  description?: string
  status?: TicketStatus
  assigneeId?: string | null
  taskId?: string | null
}

export interface TicketCommands {
  createTicket(input: CreateTicketInput): Promise<Ticket | null>
  updateTicket(ticketId: string, patch: TicketPatch): Promise<boolean>
  deleteTicket(ticketId: string): Promise<boolean>
}

export interface TicketCommandDeps {
  store: StoreApi<TicketsState>
  repo: TicketRepository
  notify: (message: string) => void
}

export function createTicketCommands({ store, repo, notify }: TicketCommandDeps): TicketCommands {
  const run = createRunner<TicketEvent>({ store, notify, errorMessage: PERSIST_ERROR })

  return {
    /**
     * SEULE commande non optimiste du module. Le numéro d'un ticket est attribué par le
     * serveur (trigger `tickets_assign_number`) : l'afficher avant sa réponse obligerait à
     * inventer une valeur puis à la corriger sous les yeux de l'utilisateur. On insère, on
     * relit la ligne créée, et on l'applique telle quelle.
     */
    async createTicket(input) {
      const s = store.getState()
      const epoch = s.epoch
      try {
        const ticket = await repo.insertTicket({
          projectId: s.projectId,
          title: input.title.trim(),
          description: input.description ?? '',
          status: input.status ?? 'todo',
          assigneeId: input.assigneeId ?? null,
          taskId: input.taskId ?? null,
        })
        // Même garde-fou que dans `createRunner`, et pour la même raison : si les données
        // affichées ont été remplacées pendant l'écriture, injecter ce ticket ferait
        // apparaître dans un projet l'entité d'un autre. Le ticket EST bien créé en base, il
        // apparaîtra au prochain chargement de son projet.
        if (store.getState().epoch !== epoch) return null
        store.getState().apply({ type: 'ticket.created', ticket })
        return ticket
      } catch (err) {
        // Cause technique au journal, message générique à l'écran : politique d'erreur du projet.
        console.error(err)
        notify(PERSIST_ERROR)
        return null
      }
    },

    updateTicket(ticketId, patch) {
      const before = store.getState().tickets[ticketId]
      if (!before) {
        notify(UNKNOWN_TICKET_ERROR)
        return Promise.resolve(false)
      }
      // Un patch vide n'a pas à produire d'écriture : la modale « Enregistrer » sans rien
      // changer ne doit ni appeler le réseau ni signaler une erreur.
      if (Object.keys(patch).length === 0) return Promise.resolve(false)

      // Valeurs D'AVANT des SEULS champs touchés, relevées sur le store : le retour arrière
      // doit rendre le ticket tel qu'il était, sans toucher au reste.
      const inversePatch: Record<string, unknown> = {}
      for (const key of Object.keys(patch)) {
        inversePatch[key] = (before as unknown as Record<string, unknown>)[key]
      }

      return run(
        { type: 'ticket.updated', ticketId, patch },
        [{ type: 'ticket.updated', ticketId, patch: inversePatch as TicketPatch }],
        () => repo.updateTicket(ticketId, patch),
      )
    },

    deleteTicket(ticketId) {
      const before = store.getState().tickets[ticketId]
      if (!before) {
        notify(UNKNOWN_TICKET_ERROR)
        return Promise.resolve(false)
      }
      // L'inverse recrée le ticket TEL QU'IL ÉTAIT, numéro compris : c'est le même ticket qui
      // revient, pas une copie neuve.
      return run(
        { type: 'ticket.deleted', ticketId },
        [{ type: 'ticket.created', ticket: before }],
        () => repo.deleteTicket(ticketId),
      )
    },
  }
}
