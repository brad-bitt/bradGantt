import { create } from 'zustand'
import type { Member, Role } from '@/lib/gantt/types'
import { applyTicketEvent, indexTickets, type TicketEvent } from './events'
import { NO_FILTERS, type Ticket, type TicketDragState, type TicketEditorState, type TicketFilters, type TicketTaskOption } from './types'

export interface TicketsHydratePayload {
  projectId: string
  projectName: string
  myRole: Role
  members: Member[]
  /** Tâches du projet, réduites à ce que le sélecteur de rattachement affiche. */
  tasks: TicketTaskOption[]
  tickets: Ticket[]
}

export interface TicketsState {
  projectId: string
  projectName: string
  myRole: Role
  members: Member[]
  tasks: TicketTaskOption[]
  tickets: Record<string, Ticket>
  /**
   * Compteur incrémenté à chaque `hydrate`, lu par `createRunner` : une commande en vol le
   * capture au départ et refuse d'annuler si la valeur a changé au retour. Même rôle que dans
   * le store du Gantt.
   */
  epoch: number
  editor: TicketEditorState
  filters: TicketFilters
  drag: TicketDragState
  hydrate: (p: TicketsHydratePayload) => void
  apply: (e: TicketEvent) => void
  openEditor: (e: Exclude<TicketEditorState, null>) => void
  closeEditor: () => void
  setFilter: <K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) => void
  setDrag: (d: TicketDragState) => void
}

export const useTicketsStore = create<TicketsState>((set) => ({
  projectId: '',
  projectName: '',
  myRole: 'viewer',
  members: [],
  tasks: [],
  tickets: {},
  epoch: 0,
  editor: null,
  filters: NO_FILTERS,
  drag: null,

  hydrate: (p) => set((s) => ({
    epoch: s.epoch + 1,
    projectId: p.projectId,
    projectName: p.projectName,
    myRole: p.myRole,
    members: p.members,
    tasks: p.tasks,
    tickets: indexTickets(p.tickets),
    editor: null,
    drag: null,
    // `filters` n'est VOLONTAIREMENT pas réinitialisé : un filtre est un geste de consultation,
    // pas une donnée du projet. Le remettre à zéro à chaque `router.refresh()` reviendrait à
    // défaire sous les doigts de l'utilisateur le tri qu'il vient de poser.
  })),

  apply: (e) => set((s) => ({ tickets: applyTicketEvent(s.tickets, e) })),
  openEditor: (editor) => set({ editor }),
  closeEditor: () => set({ editor: null }),
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  setDrag: (drag) => set({ drag }),
}))

export const selectCanEditTickets = (s: TicketsState) => s.myRole !== 'viewer'
