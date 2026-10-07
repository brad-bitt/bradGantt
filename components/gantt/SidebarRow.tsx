'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { getGanttCommands } from '@/lib/gantt/client-commands'
import { ROW_HEIGHT } from '@/lib/gantt/geometry'
import { siblingsOf } from '@/lib/gantt/scheduling'
import type { Row } from '@/lib/gantt/types'
import { countDone } from '@/lib/tickets/summary'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { useGanttView } from './GanttView'
import { useOpenContextMenu } from './ContextMenu'

export function SidebarRow({ row }: { row: Row }) {
  const { task, depth } = row
  const { canEdit, reorder, compact } = useGanttView()
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  /**
   * Cette ligne est la place VISÉE par le geste en cours. Le sélecteur retourne un booléen et
   * non l'objet de geste : la sidebar entière se re-rendrait à chaque image, alors que seules
   * deux lignes changent d'apparence.
   */
  const isDropTarget = useGanttStore((s) => {
    const d = s.drag
    if (!d || d.mode !== 'reorder' || d.taskId === task.id) return false
    const moving = s.tasks[d.taskId]
    if (!moving || moving.parentId !== task.parentId) return false
    return siblingsOf(Object.values(s.tasks), task).findIndex((x) => x.id === task.id) === d.targetIndex
  })
  const select = useGanttStore((s) => s.select)
  const openEditor = useGanttStore((s) => s.openEditor)
  const assignee = useGanttStore((s) => s.members.find((m) => m.userId === task.assigneeId))
  const ticketsEnabled = useGanttStore((s) => s.ticketsEnabled)
  // La référence du tableau vient du store et reste stable entre deux rendus : la lire
  // directement ne provoque pas de boucle, contrairement à un calcul fait dans le sélecteur.
  const ticketSummaries = useGanttStore((s) => s.ticketsByTask[task.id])
  const openMenu = useOpenContextMenu()
  const openMenuAt = useGanttStore((s) => s.openMenu)

  return (
    <div
      data-row-task-id={task.id}
      className={cn(
        'group/row flex items-center border-b border-ink/20 pr-2 select-none',
        // Sur un écran étroit, chaque pixel d'interligne est pris sur le titre.
        compact ? 'gap-1' : 'gap-2',
        // La ligne de groupe se distingue par un fond, pas par un trait de plus : elle coiffe ses
        // enfants, la sidebar doit le dire sans ajouter de bordure au décompte.
        task.type === 'group' && 'bg-band',
        selected && 'bg-yellow text-on-data',
        isDropTarget && 'shadow-[inset_0_3px_0_var(--color-ink)]',
      )}
      // Retrait d'enfant resserré sur un écran étroit : 32 px, c'est un quart d'une sidebar compacte.
      style={{ height: ROW_HEIGHT, paddingLeft: depth === 1 ? (compact ? 20 : 32) : 8 }}
      onClick={() => select({ kind: 'task', id: task.id })}
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', taskId: task.id })}
      onContextMenu={(e) => openMenu(e, { kind: 'task', id: task.id })}
    >
      {/* Largeur réservée même pour un lecteur : sans elle, les colonnes de la sidebar se
          décaleraient d'un rôle à l'autre. */}
      {canEdit ? (
        <button
          type="button"
          aria-label="Réordonner"
          // Même règle que la poignée de liaison : l'opacité tombe, le bouton reste. La colonne
          // garde donc sa largeur, et la ligne ne sursaute pas au passage de la souris.
          className="w-4 shrink-0 cursor-grab font-mono leading-none text-ink/40 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 touch:opacity-100 active:cursor-grabbing brutal-focus"
          onPointerDown={(e) => reorder.onGripPointerDown(e, task.id)}
          onClick={(e) => e.stopPropagation()}
        >
          ⋮⋮
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      {/* Le repli n'est PAS un pli d'affichage : `collapsed` est persisté et partagé par tout le
          projet. Un lecteur en voit donc l'état, sans pouvoir le changer — le bouton deviendrait
          une commande refusée par la RLS, c'est-à-dire un toast d'erreur à chaque clic. */}
      {task.type === 'group' && canEdit ? (
        <button
          type="button"
          aria-label={task.collapsed ? 'Déplier' : 'Replier'}
          className="w-5 shrink-0 text-center font-mono brutal-focus"
          onClick={(e) => { e.stopPropagation(); void getGanttCommands().toggleGroup(task.id) }}
        >
          {task.collapsed ? '▸' : '▾'}
        </button>
      ) : task.type === 'group' ? (
        <span className="w-5 shrink-0 text-center font-mono text-ink/60" aria-hidden>{task.collapsed ? '▸' : '▾'}</span>
      ) : !compact ? (
        // Colonne du chevron réservée sur une ligne de tâche, pour aligner les titres — au bureau
        // seulement : sur un téléphone, ces 20 px de vide sont un cinquième du titre.
        <span className="w-5 shrink-0" />
      ) : null}
      {task.type === 'milestone' && <span className="size-3 shrink-0 rotate-45 bg-ink" aria-hidden />}
      <span className={cn('flex-1 truncate text-sm', task.type === 'group' && 'font-display uppercase')}>{task.title}</span>
      {/* Compteur de tickets, effacé en mode compact comme l'avatar : sur un téléphone, ces
          quelques pixels sont pris sur le titre, qui est la seule chose indispensable. */}
      {ticketsEnabled && ticketSummaries && ticketSummaries.length > 0 && !compact && (() => {
        const { done, total } = countDone(ticketSummaries)
        return (
          // Texte masqué plutôt qu'aria-label : sur un <span> sans rôle, le nom n'est pas
          // annoncé de façon fiable.
          <span className="shrink-0">
            <span className="sr-only">{`${done} ticket${done > 1 ? 's' : ''} terminé${done > 1 ? 's' : ''} sur ${total}`}</span>
            {/* « ⌗ » dit de quoi parle la fraction : un « 1/2 » nu se lisait comme une date. */}
            <span aria-hidden className="border border-ink/40 px-1 font-mono text-xs text-ink-soft">⌗ {done}/{total}</span>
          </span>
        )
      })()}
      {/* L'assigné reste lisible dans l'éditeur : sur un écran étroit, son avatar cède la place au titre. */}
      {assignee && !compact && <Avatar name={assignee.displayName} color={assignee.color} src={assignee.avatarUrl} size="sm" />}
      {/* Enchaînement. Sur une tâche ou un jalon : une TÂCHE frère, insérée juste après et liée
          par défaut. Sur un groupe : un GROUPE, c'est-à-dire la phase suivante — le bouton « + »
          voisin couvre déjà le besoin d'ajouter une tâche DANS ce groupe, et un groupe ne peut
          de toute façon pas être l'enfant d'un autre. */}
      {canEdit && (
        <button
          type="button"
          aria-label={`Ajouter après « ${task.title} »`}
          title={`Ajouter après « ${task.title} »`}
          className="size-6 shrink-0 border-[3px] border-ink bg-paper font-mono text-xs leading-none opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 touch:opacity-100 hover:bg-yellow hover:text-on-data brutal-focus"
          onClick={(e) => {
            e.stopPropagation()
            openEditor({
              mode: 'create',
              parentId: task.type === 'group' ? null : task.parentId,
              type: task.type === 'group' ? 'group' : 'task',
              afterTaskId: task.id,
            })
          }}
        >
          ↳
        </button>
      )}
      {task.type === 'group' && canEdit && (
        <button
          type="button"
          aria-label="Ajouter une tâche au groupe"
          className="size-6 shrink-0 border-[3px] border-ink bg-paper font-bold leading-none opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 touch:opacity-100 hover:bg-yellow hover:text-on-data brutal-focus"
          onClick={(e) => { e.stopPropagation(); openEditor({ mode: 'create', parentId: task.id, type: 'task' }) }}
        >
          +
        </button>
      )}
      {/* Le chemin VISIBLE vers le menu de la ligne. Clic droit et double-clic restent, mais ne
          se devinent pas — et au doigt, ce bouton est la seule porte : il reste affiché en
          permanence en mode compact. Il ouvre le MÊME menu contextuel, ancré sous lui, pour ne
          pas maintenir deux listes de commandes. */}
      {canEdit && (
        <button
          type="button"
          aria-label={`Actions de « ${task.title} »`}
          aria-haspopup="menu"
          className={cn(
            'size-6 shrink-0 font-bold leading-none hover:bg-yellow hover:text-on-data brutal-focus',
            compact
              ? 'opacity-100'
              : 'opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 touch:opacity-100',
          )}
          onClick={(e) => {
            e.stopPropagation()
            const r = e.currentTarget.getBoundingClientRect()
            select({ kind: 'task', id: task.id })
            openMenuAt({ x: r.left, y: r.bottom + 4, target: { kind: 'task', id: task.id } })
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <span aria-hidden>⋯</span>
        </button>
      )}
    </div>
  )
}
