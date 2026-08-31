'use client'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast/store'
import { useGanttStore } from './store'
import { createSupabaseRepository } from './repository'
import { createCommands, type GanttCommands } from './commands'

let instance: GanttCommands | null = null

/** Commandes branchées sur Supabase + toasts. Singleton côté navigateur. */
export function getGanttCommands(): GanttCommands {
  if (!instance) {
    instance = createCommands({ store: useGanttStore, repo: createSupabaseRepository(createClient()), notify: toast.error })
  }
  return instance
}
