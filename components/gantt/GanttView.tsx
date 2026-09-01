'use client'
import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import { computeLayout, type Layout } from '@/lib/gantt/layout'
import { HEADER_HEIGHT, SIDEBAR_WIDTH, dateToX, initialScrollLeft } from '@/lib/gantt/geometry'
import { Sidebar } from './Sidebar'
import { TimelineHeader } from './TimelineHeader'
import { TimelineGrid } from './TimelineGrid'
import { TaskBar } from './TaskBar'
import { MilestoneMark } from './MilestoneMark'
import { GroupBar } from './GroupBar'
import { DependencyArrows } from './DependencyArrows'

type BarDragMode = 'move' | 'resize-start' | 'resize-end'

/**
 * Poignées de glissement des barres, fournies à partir de la tâche 11 (`useTimelineDrag`).
 * Déclarées ici dès maintenant pour que le contexte ait sa forme définitive : la tâche 11
 * n'aura qu'à rendre `drag` obligatoire, pas à réécrire le type.
 */
export interface TimelineDragHandlers {
  onBarPointerDown(e: React.PointerEvent, taskId: string, mode: BarDragMode): void
  onLinkPointerDown(e: React.PointerEvent, fromTaskId: string): void
  onPointerMove(e: React.PointerEvent): void
  onPointerUp(e: React.PointerEvent): void
}

/** Poignées de réordonnancement de la sidebar, fournies à partir de la tâche 13 (`useReorderDrag`). */
export interface ReorderDragHandlers {
  onGripPointerDown(e: React.PointerEvent, taskId: string): void
  onPointerMove(e: React.PointerEvent): void
  onPointerUp(e: React.PointerEvent): void
}

export interface GanttViewContextValue {
  layout: Layout
  canEdit: boolean
  /** Absent tant que la tâche 11 n'a pas branché le glisser-déposer. */
  drag?: TimelineDragHandlers
  /** Absent tant que la tâche 13 n'a pas branché le réordonnancement. */
  reorder?: ReorderDragHandlers
}

export const GanttViewContext = createContext<GanttViewContextValue | null>(null)

export function useGanttView() {
  const ctx = useContext(GanttViewContext)
  if (!ctx) throw new Error('useGanttView hors de GanttView')
  return ctx
}

export function GanttView() {
  const projectId = useGanttStore((s) => s.projectId)
  const tasks = useGanttStore((s) => s.tasks)
  const dependencies = useGanttStore((s) => s.dependencies)
  // `dragState` et non `drag` : la tâche 11 introduit des *handlers* nommés `drag` dans ce
  // composant, et on ne veut pas d'un renommage tardif du même identifiant.
  const dragState = useGanttStore((s) => s.drag)
  const zoom = useGanttStore((s) => s.zoom)
  const today = useGanttStore((s) => s.today)
  const canEdit = useGanttStore(selectCanEdit)
  const timelineRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  /**
   * Clé du dernier recentrage appliqué. Le recentrage est ONE-SHOT par (projet, zoom) : sans ce
   * verrou, l'effet se rejouerait à chaque changement de `layout` (donc à chaque image du
   * glisser-déposer de la tâche 11 et à chaque défilement automatique de la tâche 12) et
   * ramènerait de force la vue sur aujourd'hui, en travers de ce que fait l'utilisateur.
   */
  const centeredKey = useRef<string | null>(null)

  const layout = useMemo(
    () => computeLayout({ tasks, dependencies }, dragState, zoom, today),
    [tasks, dependencies, dragState, zoom, today],
  )
  const value = useMemo<GanttViewContextValue>(() => ({ layout, canEdit }), [layout, canEdit])

  // Sans recentrage, la vue s'ouvre sur `scrollLeft = 0`, soit un mois avant la première tâche :
  // l'écran principal de l'application paraît vide, y compris juste après la création d'un projet.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const key = `${projectId}:${zoom}`
    if (centeredKey.current === key) return
    centeredKey.current = key
    el.scrollLeft = initialScrollLeft(dateToX(today, layout.range, zoom), el.clientWidth)
  }, [projectId, zoom, today, layout.range])

  return (
    <GanttViewContext.Provider value={value}>
      <div ref={scrollRef} data-testid="gantt-scroll" className="relative flex-1 overflow-auto bg-cream">
        {/* `min-h-full` + colonne flex : sur un projet de quelques lignes, la grille et la sidebar
            s'arrêtaient net en plein écran, laissant le fond crème nu et le bord droit de la
            sidebar interrompu. Le corps s'étire désormais jusqu'en bas du conteneur. */}
        {/* Pas de `minHeight` en style inline : il l'emporterait sur `min-h-full`. La hauteur
            naturelle du contenu (en-tête + lignes) joue déjà ce rôle, `min-h-full` ne fait que
            l'étirer quand le contenu est plus court que le conteneur. */}
        <div className="relative flex min-h-full flex-col" style={{ width: SIDEBAR_WIDTH + layout.width }}>
          <div className="sticky top-0 z-30 flex" style={{ height: HEADER_HEIGHT }}>
            <div
              className="sticky left-0 z-40 flex items-center border-b-[3px] border-r-[3px] border-ink bg-yellow px-3 font-display uppercase"
              style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}
            >
              Tâches
            </div>
            <TimelineHeader />
          </div>
          {/* `flex-1` : le corps prend toute la hauteur restante ; ses deux enfants (sidebar et
              timeline) s'étirent avec lui par `align-items: stretch`, d'où des hauteurs en
              `minHeight` et non plus en `height` fixe. */}
          <div className="flex flex-1">
            <Sidebar />
            <div ref={timelineRef} className="relative" style={{ width: layout.width, minHeight: Math.max(layout.height, 1) }}>
              <TimelineGrid />
              {layout.rows.map((row) => {
                const rect = layout.rects[row.task.id]
                if (row.task.type === 'milestone') return <MilestoneMark key={row.task.id} task={row.task} rect={rect} />
                if (row.task.type === 'group') return <GroupBar key={row.task.id} task={row.task} rect={rect} />
                return <TaskBar key={row.task.id} task={row.task} rect={rect} />
              })}
              <DependencyArrows />
              {layout.rows.length === 0 && (
                <p className="absolute left-4 top-4 bg-paper brutal px-4 py-2 font-bold">Aucune tâche pour l&apos;instant.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </GanttViewContext.Provider>
  )
}
