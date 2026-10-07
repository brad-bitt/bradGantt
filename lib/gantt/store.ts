import { create } from 'zustand'
import type { ContextMenuState, Dependency, DragState, EditorState, GanttData, Member, Role, Selection, Task, Zoom } from './types'
import { applyEvent, indexById, type GanttEvent } from './events'
import { isLate } from './summary'
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
  /**
   * Mise en évidence du retard, allumée depuis le pied de page. Un regard, pas une donnée : rien
   * n'est persisté, et `hydrate` l'éteint.
   */
  highlightLate: boolean
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
  toggleHighlightLate: () => void
  setHighlightLate: (on: boolean) => void
}

/**
 * Compteur de module des demandes de recentrage. Hors du store : `hydrate` remet la demande à
 * `null`, et un compteur rangé dans l'état repartirait à 1 — `GanttView`, qui retient le dernier
 * numéro traité, prendrait la première demande du projet suivant pour une demande déjà servie.
 */
let scrollSeq = 0

export const useGanttStore = create<GanttState>((set, get) => ({
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
  highlightLate: false,

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
    highlightLate: false,
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
  toggleHighlightLate: () => {
    const s = get()
    if (s.highlightLate) { set({ highlightLate: false }); return }
    // En allumant, la frise va chercher le retard le plus ANCIEN : il peut être loin à gauche
    // d'une vue recentrée sur aujourd'hui, et une mise en évidence hors champ ne montre rien.
    const first = Object.values(s.tasks)
      .filter((t) => isLate(t, s.today))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    set(first
      ? { highlightLate: true, scrollTarget: { date: first.startDate, seq: ++scrollSeq } }
      : { highlightLate: true })
  },
  setHighlightLate: (highlightLate) => set({ highlightLate }),
}))

export const selectCanEdit = (s: GanttState) => s.myRole !== 'viewer'

/**
 * La mise en évidence n'est EFFECTIVE que s'il reste du retard à distinguer : le bouton qui
 * l'éteint disparaît avec le dernier retard (tâche achevée ou supprimée), et un drapeau resté
 * allumé atténuerait tout le diagramme sans aucune commande pour en sortir.
 */
export const selectHighlightActive = (s: GanttState) =>
  s.highlightLate && Object.values(s.tasks).some((t) => isLate(t, s.today))
