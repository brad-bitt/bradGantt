'use client'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast/store'
import { useTicketsStore } from './store'
import { createSupabaseTicketRepository } from './repository'
import { createTicketCommands, type TicketCommands } from './commands'

let instance: TicketCommands | null = null

/** Commandes branchées sur Supabase + toasts. Singleton côté navigateur, comme pour le Gantt. */
export function getTicketCommands(): TicketCommands {
  if (!instance) {
    instance = createTicketCommands({
      store: useTicketsStore,
      repo: createSupabaseTicketRepository(createClient()),
      notify: toast.error,
    })
  }
  return instance
}
