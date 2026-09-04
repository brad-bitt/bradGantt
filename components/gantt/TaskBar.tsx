'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { BAR_BORDER_PX, LINK_HANDLE_PX, resizeHandleWidth } from '@/lib/gantt/geometry'
import type { Rect, Task } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'
import { useGanttView } from './GanttView'

export function TaskBar({ task, rect }: { task: Task; rect: Rect }) {
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  const openEditor = useGanttStore((s) => s.openEditor)
  const { drag, canEdit } = useGanttView()
  // Bornée au quart de la barre : à 8 px fixes, les deux poignées mangeaient toute barre plus
  // étroite que 16 px et il ne restait plus rien à saisir pour la déplacer (au zoom mois, une
  // tâche de 3 jours fait 12 px). Il reste désormais au moins la moitié de la barre.
  const handle = resizeHandleWidth(rect.width)
  return (
    <div
      data-task-id={task.id}
      title={`${task.title} — ${task.startDate} → ${task.endDate}`}
      className={cn(
        // Plus d'`overflow-hidden` ici : la poignée de liaison de la tâche 12 déborde de la
        // barre. Le rognage du titre est assuré par le `truncate` du <span>, à qui `min-w-0`
        // donne le droit de rétrécir sous sa largeur de contenu (un enfant flex ne le fait pas
        // de lui-même).
        'group/bar absolute flex items-center border-[3px] border-ink shadow-brutal select-none touch-none',
        canEdit && 'cursor-grab active:cursor-grabbing',
        selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2',
      )}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, backgroundColor: task.color }}
      // `onPointerDown` et non `onClick` : le geste doit être armé avant le premier déplacement.
      // La sélection reste assurée (le hook la pose même pour un lecteur).
      onPointerDown={(e) => drag.onBarPointerDown(e, task.id, 'move')}
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', taskId: task.id })}
    >
      <div
        className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(45deg,#111_0_4px,transparent_4px_8px)] opacity-25"
        style={{ width: `${task.progress}%` }}
        aria-hidden
      />
      {canEdit && (
        <>
          {/* Enfants de la barre : leur `stopPropagation` (dans le hook) empêche la barre
              d'armer un déplacement par-dessus le redimensionnement. */}
          {/* Décalées de l'épaisseur de la bordure : posées à `left: 0`, elles commenceraient
              après elle et se retrouveraient au milieu d'une barre étroite. */}
          <div
            data-handle="resize-start"
            className="absolute z-10 cursor-ew-resize"
            style={{ width: handle, left: -BAR_BORDER_PX, top: -BAR_BORDER_PX, bottom: -BAR_BORDER_PX }}
            onPointerDown={(e) => drag.onBarPointerDown(e, task.id, 'resize-start')}
          />
          <div
            data-handle="resize-end"
            className="absolute z-10 cursor-ew-resize"
            style={{ width: handle, right: -BAR_BORDER_PX, top: -BAR_BORDER_PX, bottom: -BAR_BORDER_PX }}
            onPointerDown={(e) => drag.onBarPointerDown(e, task.id, 'resize-end')}
          />
          {/* Posée entièrement HORS de la barre : voir `LINK_HANDLE_PX`. Un décalage exprimé en
              classe (`-right-4`) ne le permet pas — il faut y ajouter l'épaisseur de la bordure. */}
          {/* Invisible au repos : une pastille blanche par barre, en permanence, se lisait comme
              un artefact détaché du dessin. C'est l'OPACITÉ qui tombe, pas le rendu — la pastille
              reste dans le document, donc la zone de saisie du geste ne bouge pas d'un pixel
              selon qu'on survole ou non. Elle revient au survol, au clavier et sur la barre
              sélectionnée, les trois manières d'avoir cette barre « en main ». */}
          <button
            type="button"
            aria-label="Créer une dépendance"
            style={{ width: LINK_HANDLE_PX, height: LINK_HANDLE_PX, right: -(LINK_HANDLE_PX + BAR_BORDER_PX) }}
            className={cn(
              'absolute top-1/2 z-20 -translate-y-1/2 border-[3px] border-ink bg-paper cursor-crosshair hover:bg-yellow',
              'opacity-0 transition-opacity group-hover/bar:opacity-100 focus-visible:opacity-100',
              selected && 'opacity-100',
            )}
            onPointerDown={(e) => drag.onLinkPointerDown(e, task.id)}
            // Le geste se joue au pointeur ; le clic qui le suit ne doit pas remonter à la barre.
            onClick={(e) => e.stopPropagation()}
          />
        </>
      )}
      <span className="relative min-w-0 truncate px-2 text-sm font-bold">{task.title}</span>
    </div>
  )
}
