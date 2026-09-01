'use client'
import { createContext, useContext, useMemo, useRef } from 'react'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import { computeLayout, type Layout } from '@/lib/gantt/layout'
import { HEADER_HEIGHT, SIDEBAR_WIDTH } from '@/lib/gantt/geometry'
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
  const tasks = useGanttStore((s) => s.tasks)
  const dependencies = useGanttStore((s) => s.dependencies)
  // `dragState` et non `drag` : la tâche 11 introduit des *handlers* nommés `drag` dans ce
  // composant, et on ne veut pas d'un renommage tardif du même identifiant.
  const dragState = useGanttStore((s) => s.drag)
  const zoom = useGanttStore((s) => s.zoom)
  const today = useGanttStore((s) => s.today)
  const canEdit = useGanttStore(selectCanEdit)
  const timelineRef = useRef<HTMLDivElement>(null)

  const layout = useMemo(
    () => computeLayout({ tasks, dependencies }, dragState, zoom, today),
    [tasks, dependencies, dragState, zoom, today],
  )
  const value = useMemo<GanttViewContextValue>(() => ({ layout, canEdit }), [layout, canEdit])

  return (
    <GanttViewContext.Provider value={value}>
      <div className="relative flex-1 overflow-auto bg-cream">
        <div className="relative" style={{ width: SIDEBAR_WIDTH + layout.width, minHeight: HEADER_HEIGHT + layout.height }}>
          <div className="sticky top-0 z-30 flex" style={{ height: HEADER_HEIGHT }}>
            <div
              className="sticky left-0 z-40 flex items-center border-b-[3px] border-r-[3px] border-ink bg-yellow px-3 font-display uppercase"
              style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}
            >
              Tâches
            </div>
            <TimelineHeader />
          </div>
          <div className="flex">
            <Sidebar />
            <div ref={timelineRef} className="relative" style={{ width: layout.width, height: Math.max(layout.height, 1) }}>
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
