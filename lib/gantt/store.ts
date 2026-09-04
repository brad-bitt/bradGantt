import { create } from 'zustand'
import type { Dependency, DragState, EditorState, GanttData, Member, Role, Selection, Task, Zoom } from './types'
import { applyEvent, indexById, type GanttEvent } from './events'
import type { PendingInvitation } from '@/lib/invitations/types'

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
  zoom: Zoom
  selection: Selection
  drag: DragState | null
  editor: EditorState
  membersDialogOpen: boolean
  hydrate: (p: HydratePayload) => void
  apply: (e: GanttEvent) => void
  setZoom: (z: Zoom) => void
  select: (s: Selection) => void
  setDrag: (d: DragState | null) => void
  openEditor: (e: Exclude<EditorState, null>) => void
  closeEditor: () => void
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
  zoom: 'day',
  selection: null,
  drag: null,
  editor: null,
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
    selection: null,
    drag: null,
    editor: null,
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
  setMembersDialogOpen: (membersDialogOpen) => set({ membersDialogOpen }),
}))

export const selectCanEdit = (s: GanttState) => s.myRole !== 'viewer'
