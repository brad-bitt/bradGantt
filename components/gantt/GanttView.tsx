'use client'
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { useTimelineDrag, type TimelineDragHandlers } from './useTimelineDrag'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useReorderDrag, type ReorderDragHandlers } from './useReorderDrag'

export interface GanttViewContextValue {
  layout: Layout
  canEdit: boolean
  drag: TimelineDragHandlers
  reorder: ReorderDragHandlers
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
  // `dragState` est l'ÉTAT du geste (l'aperçu, qui entre dans `computeLayout`) ; `drag`, plus
  // bas, en est le jeu de *poignées*. Deux choses distinctes, deux noms distincts.
  const dragState = useGanttStore((s) => s.drag)
  const zoom = useGanttStore((s) => s.zoom)
  const today = useGanttStore((s) => s.today)
  const canEdit = useGanttStore(selectCanEdit)
  const select = useGanttStore((s) => s.select)
  const timelineRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  /**
   * Clé du dernier recentrage appliqué. Le recentrage est ONE-SHOT par (projet, zoom) : sans ce
   * verrou, l'effet se rejouerait à chaque changement de `layout` (donc à chaque image du
   * glisser-déposer de la tâche 11 et à chaque défilement automatique de la tâche 12) et
   * ramènerait de force la vue sur aujourd'hui, en travers de ce que fait l'utilisateur.
   */
  const centeredKey = useRef<string | null>(null)
  /**
   * Largeur du conteneur défilant, mesurée UNE FOIS au montage puis à chaque redimensionnement —
   * jamais pendant le rendu. `computeLayout` tourne à chaque image du glisser-déposer : y lire le
   * DOM forcerait un recalcul de mise en page 60 fois par seconde. `null` = pas encore mesurée.
   */
  const [viewportWidth, setViewportWidth] = useState<number | null>(null)
  const drag = useTimelineDrag(timelineRef)
  const reorder = useReorderDrag()
  useKeyboardShortcuts()

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // `setState` avec la même valeur ne re-rend pas : observer ne peut pas s'emballer.
    const measure = () => setViewportWidth(el.clientWidth)
    measure()
    // jsdom n'implémente pas ResizeObserver ; le repli sur `resize` couvre le seul cas qui
    // change la largeur ici (la fenêtre), la sidebar étant de largeur fixe.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Largeur visible de la TIMELINE : le conteneur moins la sidebar collante qui en masque
  // les premiers pixels. Bornée à zéro pour un conteneur plus étroit que la sidebar.
  const visibleTimelineWidth = Math.max((viewportWidth ?? 0) - SIDEBAR_WIDTH, 0)

  const layout = useMemo(
    () => computeLayout({ tasks, dependencies }, dragState, zoom, today, visibleTimelineWidth),
    [tasks, dependencies, dragState, zoom, today, visibleTimelineWidth],
  )
  const value = useMemo<GanttViewContextValue>(() => ({ layout, canEdit, drag, reorder }), [layout, canEdit, drag, reorder])

  // Sans recentrage, la vue s'ouvre sur `scrollLeft = 0`, soit un mois avant la première tâche :
  // l'écran principal de l'application paraît vide, y compris juste après la création d'un projet.
  useEffect(() => {
    const el = scrollRef.current
    // Tant que la largeur n'est pas mesurée, la plage n'est pas encore étendue et le contenu peut
    // être plus étroit que l'écran : le navigateur ramènerait le défilement à 0. On attend donc la
    // mesure pour ne dépenser l'unique recentrage qu'une fois la timeline à sa largeur définitive.
    if (!el || viewportWidth === null) return
    const key = `${projectId}:${zoom}`
    if (centeredKey.current === key) return
    centeredKey.current = key
    el.scrollLeft = initialScrollLeft(dateToX(today, layout.range, zoom), el.clientWidth)
  }, [projectId, zoom, today, layout.range, viewportWidth])

  return (
    <GanttViewContext.Provider value={value}>
      <div ref={scrollRef} data-testid="gantt-scroll" className="relative flex-1 overflow-auto bg-cream">
        {/* `min-h-full` + colonne flex : sur un projet de quelques lignes, la grille et la sidebar
            s'arrêtaient net en plein écran, laissant le fond crème nu et le bord droit de la
            sidebar interrompu. Le corps s'étire désormais jusqu'en bas du conteneur. */}
        {/* Pas de `minHeight` en style inline : il l'emporterait sur `min-h-full`. La hauteur
            naturelle du contenu (en-tête + lignes) joue déjà ce rôle, `min-h-full` ne fait que
            l'étirer quand le contenu est plus court que le conteneur. */}
        {/* `data-testid` : c'est la largeur de CE bloc qui dit si la timeline remplit l'écran.
            Le `scrollWidth` du conteneur ne le dit pas — il vaut au minimum son `clientWidth`,
            donc il affichait déjà « 1280 sur 1280 » alors que le contenu n'en faisait que 584. */}
        <div
          data-testid="gantt-content"
          className="relative flex min-h-full flex-col"
          style={{ width: SIDEBAR_WIDTH + layout.width }}
        >
          <div className="sticky top-0 z-30 flex" style={{ height: HEADER_HEIGHT }}>
            <div
              className="sticky left-0 z-40 flex items-center border-b-[3px] border-r-[3px] border-ink bg-cream px-3 font-display uppercase"
              style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}
            >
              Tâches
            </div>
            <TimelineHeader />
          </div>
          {/* Message ancré au bord gauche du CONTENEUR défilé, pas au contenu : posé en `absolute`
              dans la timeline, le recentrage sur aujourd'hui le poussait hors du champ (mesuré à
              x = -639 sur un projet neuf), et l'utilisateur atterrissait sur une grille nue sans
              la moindre indication. `sticky left-0` le maintient visible quel que soit le
              défilement horizontal — même technique que la cellule « Tâches » de l'en-tête. */}
          {/* `my-4` et non `mt-4` : la marge haute seule laissait la boîte collée au corps de la
              grille juste en dessous. La marge est verticale, jamais horizontale — un `ml`/`mx`
              décalerait la boîte à l'intérieur de son conteneur défilé et le `sticky left-4`,
              qui se mesure sur le CONTENEUR, cesserait de la ramener au même endroit. */}
          {layout.rows.length === 0 && (
            <p className="sticky left-4 z-20 my-4 w-fit bg-paper brutal px-4 py-2 font-bold">Aucune tâche pour l&apos;instant.</p>
          )}
          {/* `flex-1` : le corps prend toute la hauteur restante ; ses deux enfants (sidebar et
              timeline) s'étirent avec lui par `align-items: stretch`, d'où des hauteurs en
              `minHeight` et non plus en `height` fixe. */}
          <div className="flex flex-1">
            <Sidebar />
            {/* Le suivi et le relâchement du geste sont écoutés ici, pas sur la barre : dès le
                premier pixel parcouru le pointeur en sort. `onPointerCancel` a son PROPRE
                gestionnaire : un geste repris par le système n'a jamais été relâché par
                l'utilisateur, il s'abandonne au lieu de s'enregistrer. */}
            <div
              ref={timelineRef}
              className="relative"
              style={{ width: layout.width, minHeight: Math.max(layout.height, 1) }}
              // Clic sur le FOND de la timeline (et non sur une barre) : on désélectionne. Le
              // test `e.target === e.currentTarget` suffit parce que `TimelineGrid` est en
              // `pointer-events-none` — le clic entre deux barres atteint bien ce conteneur.
              onPointerDown={(e) => { if (e.target === e.currentTarget) select(null) }}
              onPointerMove={drag.onPointerMove}
              onPointerUp={drag.onPointerUp}
              onPointerCancel={drag.onPointerCancel}
            >
              <TimelineGrid />
              {layout.rows.map((row) => {
                const rect = layout.rects[row.task.id]
                if (row.task.type === 'milestone') return <MilestoneMark key={row.task.id} task={row.task} rect={rect} />
                if (row.task.type === 'group') return <GroupBar key={row.task.id} task={row.task} rect={rect} />
                return <TaskBar key={row.task.id} task={row.task} rect={rect} />
              })}
              <DependencyArrows />
            </div>
          </div>
        </div>
      </div>
    </GanttViewContext.Provider>
  )
}
