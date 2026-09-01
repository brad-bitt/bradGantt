import { create } from 'zustand'
import type { Dependency, DragState, EditorState, GanttData, Member, Role, Selection, Task, Zoom } from './types'
import { applyEvent, indexById, type GanttEvent } from './events'

export interface HydratePayload {
  projectId: string
  projectName: string
  myRole: Role
  members: Member[]
  tasks: Task[]
  dependencies: Dependency[]
  today: string
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
  zoom: Zoom
  selection: Selection
  drag: DragState | null
  editor: EditorState
  hydrate: (p: HydratePayload) => void
  apply: (e: GanttEvent) => void
  setZoom: (z: Zoom) => void
  select: (s: Selection) => void
  setDrag: (d: DragState | null) => void
  openEditor: (e: Exclude<EditorState, null>) => void
  closeEditor: () => void
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
  zoom: 'day',
  selection: null,
  drag: null,
  editor: null,

  hydrate: (p) => set((s) => ({
    epoch: s.epoch + 1,
    projectId: p.projectId,
    projectName: p.projectName,
    myRole: p.myRole,
    members: p.members,
    today: p.today,
    tasks: indexById(p.tasks),
    dependencies: indexById(p.dependencies),
    selection: null,
    drag: null,
    editor: null,
  })),
  apply: (e) => set((s) => applyEvent({ tasks: s.tasks, dependencies: s.dependencies }, e)),
  setZoom: (zoom) => set({ zoom }),
  select: (selection) => set({ selection }),
  setDrag: (drag) => set({ drag }),
  openEditor: (editor) => set({ editor }),
  closeEditor: () => set({ editor: null }),
}))

export const selectCanEdit = (s: GanttState) => s.myRole !== 'viewer'
