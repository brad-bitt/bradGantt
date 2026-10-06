import { create } from 'zustand'
import type { ContextMenuState, Dependency, DragState, EditorState, GanttData, Member, Role, Selection, Task, Zoom } from './types'
import { applyEvent, indexById, type GanttEvent } from './events'
import type { TicketSummary } from '@/lib/tickets/types'

export interface HydratePayload {
  projectId: string
  projectName: string
  myRole: Role
  members: Member[]
  tasks: Task[]
  dependencies: Dependency[]
  today: string
  /** Le projet affiche-t-il ses tickets. Faux : ni lien, ni compteur, ni section dans l'éditeur. */
  ticketsEnabled?: boolean
  /**
   * RÉSUMÉ seulement, groupé par tâche. Le store du Gantt ne contient volontairement aucun
   * ticket complet : le backlog vit dans `lib/tickets`, sur sa propre route.
   */
  ticketsByTask?: Record<string, TicketSummary[]>
}

export interface GanttState extends GanttData {
  projectId: string
  projectName: string
  myRole: Role
  members: Member[]
  today: string
  /**
   * Compteur incrémenté à chaque `hydrate`. Une commande en vol le capture au départ et
   * refuse d'annuler si la valeur a changé au retour : entre-temps les données affichées
   * ont été remplacées (navigation vers un autre projet, ou simple rechargement du même),
   * et rejouer l'événement inverse réinjecterait des entités périmées dans un état frais.
   */
  epoch: number
  ticketsEnabled: boolean
  ticketsByTask: Record<string, TicketSummary[]>
  zoom: Zoom
  selection: Selection
  drag: DragState | null
  editor: EditorState
  menu: ContextMenuState
  /**
   * Demande de recentrage de la frise sur une date. `seq` change à CHAQUE demande, même pour la
   * même date : « Aujourd'hui » cliqué deux fois doit recentrer deux fois.
   */
  scrollTarget: { date: string; seq: number } | null
  hydrate: (p: HydratePayload) => void
  apply: (e: GanttEvent) => void
  setZoom: (z: Zoom) => void
  select: (s: Selection) => void
  setDrag: (d: DragState | null) => void
  openEditor: (e: Exclude<EditorState, null>) => void
  closeEditor: () => void
  openMenu: (menu: Exclude<ContextMenuState, null>) => void
  closeMenu: () => void
  scrollToDate: (date: string) => void
}

/**
 * Compteur de module des demandes de recentrage. Hors du store : `hydrate` remet la demande à
 * `null`, et un compteur rangé dans l'état repartirait à 1 — `GanttView`, qui retient le dernier
 * numéro traité, prendrait la première demande du projet suivant pour une demande déjà servie.
 */
let scrollSeq = 0

export const useGanttStore = create<GanttState>((set) => ({
  projectId: '',
  projectName: '',
  myRole: 'viewer',
  members: [],
  today: '1970-01-01',
  epoch: 0,
  tasks: {},
  dependencies: {},
  ticketsEnabled: false,
  ticketsByTask: {},
  zoom: 'day',
  selection: null,
  drag: null,
  editor: null,
  menu: null,
  scrollTarget: null,

  hydrate: (p) => set((s) => ({
    epoch: s.epoch + 1,
    projectId: p.projectId,
    projectName: p.projectName,
    myRole: p.myRole,
    members: p.members,
    today: p.today,
    tasks: indexById(p.tasks),
    dependencies: indexById(p.dependencies),
    ticketsEnabled: p.ticketsEnabled ?? false,
    ticketsByTask: p.ticketsByTask ?? {},
    selection: null,
    drag: null,
    editor: null,
    menu: null,
  scrollTarget: null,
  })),
  apply: (e) => set((s) => applyEvent({ tasks: s.tasks, dependencies: s.dependencies }, e)),
  setZoom: (zoom) => set({ zoom }),
  select: (selection) => set({ selection }),
  setDrag: (drag) => set({ drag }),
  openEditor: (editor) => set({ editor }),
  closeEditor: () => set({ editor: null }),
  openMenu: (menu) => set({ menu }),
  closeMenu: () => set({ menu: null }),
  scrollToDate: (date) => set({ scrollTarget: { date, seq: ++scrollSeq } }),
}))

export const selectCanEdit = (s: GanttState) => s.myRole !== 'viewer'
