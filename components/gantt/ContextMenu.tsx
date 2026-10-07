'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import { getGanttCommands } from '@/lib/gantt/client-commands'
import { parseDate } from '@/lib/gantt/dates'
import type { ContextMenuState, MenuTarget, Task } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'

/**
 * Ouvre le menu contextuel sur `target`, à la position du clic. Pour un lecteur, ne fait RIEN
 * — le navigateur garde son propre menu, il n'y a aucune action à proposer.
 *
 * Le clic droit sélectionne aussi sa cible, comme dans tout logiciel de bureau : l'objet visé
 * doit être celui qu'on voit en surbrillance pendant qu'on choisit.
 */
export function useOpenContextMenu() {
  const canEdit = useGanttStore(selectCanEdit)
  const openMenu = useGanttStore((s) => s.openMenu)
  const select = useGanttStore((s) => s.select)
  return useCallback(
    (e: ReactMouseEvent, target: MenuTarget) => {
      if (!canEdit) return
      e.preventDefault()
      e.stopPropagation()
      if (target.kind === 'task') select({ kind: 'task', id: target.id })
      else if (target.kind === 'dependency') select({ kind: 'dependency', id: target.id })
      openMenu({ x: e.clientX, y: e.clientY, target })
    },
    [canEdit, openMenu, select],
  )
}

export interface MenuItem {
  id: string
  label: string
  danger?: boolean
  run: () => void | Promise<unknown>
}

/**
 * Les entrées du menu pour une cible. Fonction PURE de l'état, testable sans DOM : chaque
 * entrée porte l'action qu'elle déclenche, le composant ne fait que les afficher.
 */
export function buildMenuItems(target: MenuTarget, tasks: Record<string, Task>): MenuItem[] {
  const store = useGanttStore.getState()
  const cmd = () => getGanttCommands()

  if (target.kind === 'dependency') {
    return [{ id: 'unlink', label: 'Supprimer le lien', danger: true, run: () => cmd().unlinkTasks(target.id) }]
  }

  if (target.kind === 'timeline') {
    const when = format(parseDate(target.date), 'd MMM', { locale: fr })
    return [
      { id: 'new-task', label: `Nouvelle tâche le ${when}`, run: () => store.openEditor({ mode: 'create', parentId: null, type: 'task', startDate: target.date }) },
      { id: 'new-milestone', label: `Nouveau jalon le ${when}`, run: () => store.openEditor({ mode: 'create', parentId: null, type: 'milestone', startDate: target.date }) },
      { id: 'new-group', label: 'Nouveau groupe', run: () => store.openEditor({ mode: 'create', parentId: null, type: 'group' }) },
    ]
  }

  const task = tasks[target.id]
  if (!task) return []
  const edit: MenuItem = { id: 'edit', label: 'Modifier…', run: () => store.openEditor({ mode: 'edit', taskId: task.id }) }
  // Même confirmation et même libellé que la touche Suppr : un geste, une phrase.
  const remove: MenuItem = {
    id: 'delete',
    label: task.type === 'group' ? 'Supprimer le groupe et ses tâches' : 'Supprimer',
    danger: true,
    run: () => {
      const label = task.type === 'group'
        ? `Supprimer le groupe « ${task.title} » et toutes ses tâches ?`
        : `Supprimer « ${task.title} » ?`
      if (!window.confirm(label)) return
      store.select(null)
      return cmd().deleteTask(task.id)
    },
  }

  if (task.type === 'group') {
    return [
      edit,
      { id: 'add-child', label: 'Ajouter une tâche dans le groupe', run: () => store.openEditor({ mode: 'create', parentId: task.id, type: 'task' }) },
      { id: 'after', label: 'Groupe suivant ↳', run: () => store.openEditor({ mode: 'create', parentId: null, type: 'group', afterTaskId: task.id }) },
      { id: 'toggle', label: task.collapsed ? 'Déplier' : 'Replier', run: () => cmd().toggleGroup(task.id) },
      remove,
    ]
  }

  return [
    edit,
    { id: 'after', label: 'Ajouter après ↳', run: () => store.openEditor({ mode: 'create', parentId: task.parentId, type: 'task', afterTaskId: task.id }) },
    { id: 'duplicate', label: 'Dupliquer', run: () => cmd().duplicateTask(task.id) },
    remove,
  ]
}

export function ContextMenu() {
  const menu = useGanttStore((s) => s.menu)
  const canEdit = useGanttStore(selectCanEdit)
  const closeMenu = useGanttStore((s) => s.closeMenu)
  if (!menu || !canEdit) return null
  // La clé remonte la position : un second clic droit ailleurs remonte un menu neuf, avec son
  // focus initial et sa mesure de position, au lieu de déplacer l'ancien.
  return <Menu key={`${menu.x}:${menu.y}`} menu={menu} onClose={closeMenu} />
}

/** Marge minimale entre le menu et le bord de la fenêtre, en pixels. */
const EDGE = 8

function Menu({ menu, onClose }: { menu: Exclude<ContextMenuState, null>; onClose: () => void }) {
  const tasks = useGanttStore((s) => s.tasks)
  const items = buildMenuItems(menu.target, tasks)
  const ref = useRef<HTMLDivElement>(null)
  // Élément qui avait le focus à l'ouverture — le « ⋯ » d'une ligne, quand on vient du clavier.
  // Lu au premier rendu, AVANT que `useLayoutEffect` ne déplace le focus sur le premier item.
  const opener = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement)
  // Position définitive, calculée UNE FOIS le menu mesuré : posé au point du clic, il déborde
  // de la fenêtre près d'un bord droit ou bas, on le rabat alors vers l'intérieur.
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: menu.x, y: menu.y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPos({
      x: Math.max(EDGE, Math.min(menu.x, window.innerWidth - width - EDGE)),
      y: Math.max(EDGE, Math.min(menu.y, window.innerHeight - height - EDGE)),
    })
    el.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [menu.x, menu.y])

  useEffect(() => {
    // Tout ce qui n'est pas le menu le ferme : clic ailleurs (y compris un autre clic droit,
    // qui en rouvrira un), défilement, redimensionnement, Échap.
    const onPointerDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      const list = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
      if (list.length === 0) return
      const i = list.indexOf(document.activeElement as HTMLElement)
      if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus() }
      if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus() }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  useEffect(() => {
    const node = ref.current
    const from = opener.current
    return () => {
      // À la fermeture, le focus revient d'où il venait — seulement s'il était dans le menu (le
      // menu retiré, il retombe sur `body`) : un clic ailleurs a déjà posé le focus là où
      // l'utilisateur le voulait.
      const active = document.activeElement
      const lost = active === document.body || (node?.contains(active) ?? false)
      if (lost && from instanceof HTMLElement && document.contains(from)) from.focus({ preventScroll: true })
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div
      ref={ref}
      role="menu"
      data-testid="context-menu"
      className="fixed z-50 min-w-56 bg-paper brutal shadow-brutal-lg py-1"
      style={{ left: pos.x, top: pos.y }}
      // Un clic droit SUR le menu ne doit ni rouvrir le menu natif ni fermer celui-ci.
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          onClick={() => { onClose(); void item.run() }}
          className={cn(
            // Casse mixte : un menu est une liste de commandes, pas une suite de titres.
            'block w-full px-4 py-2 text-left text-sm font-bold outline-none hover:bg-yellow hover:text-on-data focus-visible:bg-yellow focus-visible:text-on-data',
            // Le destructif est sobre au repos (texte rouge) et ne s'aplatit en rouge qu'au survol.
            item.danger && 'text-danger hover:bg-danger hover:text-on-data focus-visible:bg-danger',
            item.danger && i > 0 && 'mt-1 border-t-[3px] border-ink pt-2',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
