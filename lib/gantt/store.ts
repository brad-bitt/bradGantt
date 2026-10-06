import { create } from 'zustand'
import type { ContextMenuState, Dependency, DragState, EditorState, GanttData, Member, Role, Selection, Task, Zoom } from './types'
import { applyEvent, indexById, type GanttEvent } from './events'
import type { PendingInvitation } from '@/lib/invitations/types'
import type { TicketSummary } from '@/lib/tickets/types'

export interface HydratePayload {
  projectId: string
  projectName: string
  myRole: Role
  members: Member[]
  tasks: Task[]
  dependencies: Dependency[]
  today: string
  /** Absent pour un non-owner : la RLS ne lui montre aucune invitation. */
  invitations?: PendingInvitation[]
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
  invitations: PendingInvitation[]
  ticketsEnabled: boolean
  ticketsByTask: Record<string, TicketSummary[]>
  zoom: Zoom
  selection: Selection
  drag: DragState | null
  editor: EditorState
  menu: ContextMenuState
  membersDialogOpen: boolean
  hydrate: (p: HydratePayload) => void
  apply: (e: GanttEvent) => void
  setZoom: (z: Zoom) => void
  select: (s: Selection) => void
  setDrag: (d: DragState | null) => void
  openEditor: (e: Exclude<EditorState, null>) => void
  closeEditor: () => void
  openMenu: (menu: Exclude<ContextMenuState, null>) => void
  closeMenu: () => void
  setMembersDialogOpen: (open: boolean) => void
}

export const useGanttStore = create<GanttState>((set) => ({
  projectId: '',
  projectName: '',
  myRole: 'viewer',
  members: [],
  today: '1970-01-01',
  epoch: 0,
  tasks: {},
  dependencies: {},
  invitations: [],
  ticketsEnabled: false,
  ticketsByTask: {},
  zoom: 'day',
  selection: null,
  drag: null,
  editor: null,
  menu: null,
  membersDialogOpen: false,

  hydrate: (p) => set((s) => ({
    epoch: s.epoch + 1,
    projectId: p.projectId,
    projectName: p.projectName,
    myRole: p.myRole,
    members: p.members,
    today: p.today,
    tasks: indexById(p.tasks),
    dependencies: indexById(p.dependencies),
    invitations: p.invitations ?? [],
    ticketsEnabled: p.ticketsEnabled ?? false,
    ticketsByTask: p.ticketsByTask ?? {},
    selection: null,
    drag: null,
    editor: null,
    menu: null,
    // `membersDialogOpen` n'est VOLONTAIREMENT pas réinitialisé : chaque changement de rôle ou
    // de membre appelle `router.refresh()`, donc `hydrate`. Le remettre à `false` refermerait
    // le dialog sous les doigts de l'owner à chaque modification qu'il vient de faire.
  })),
  apply: (e) => set((s) => applyEvent({ tasks: s.tasks, dependencies: s.dependencies }, e)),
  setZoom: (zoom) => set({ zoom }),
  select: (selection) => set({ selection }),
  setDrag: (drag) => set({ drag }),
  openEditor: (editor) => set({ editor }),
  closeEditor: () => set({ editor: null }),
  openMenu: (menu) => set({ menu }),
  closeMenu: () => set({ menu: null }),
  setMembersDialogOpen: (membersDialogOpen) => set({ membersDialogOpen }),
}))

export const selectCanEdit = (s: GanttState) => s.myRole !== 'viewer'
