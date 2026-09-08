'use client'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import { SIDEBAR_WIDTH } from '@/lib/gantt/geometry'
import { Button } from '@/components/ui/Button'

/**
 * Écran d'accueil d'un projet sans aucune tâche.
 *
 * Il remplace une boîte de deux mots posée sur une grille nue : c'était le premier écran d'un
 * projet neuf, et il ne disait ni quoi faire ni par où commencer.
 *
 * Les trois boutons NE REPRENNENT PAS les libellés de la barre d'outils (« + Tâche »…) : deux
 * boutons de même nom coexisteraient à l'écran, indiscernables pour un lecteur d'écran comme
 * pour un test. « Première tâche » dit en plus ce que le geste a de particulier ici.
 *
 * `sticky` et non `absolute` : la carte est ancrée à la largeur de la sidebar, mesurée sur le
 * CONTENEUR défilé. Posée dans la timeline, le recentrage initial sur aujourd'hui la pousserait
 * hors du champ (mesuré à x = -639 sur un projet neuf) et on atterrirait sur une grille nue sans
 * la moindre indication ; ici, elle reste au même endroit quel que soit le défilement horizontal.
 */
export function EmptyProject() {
  const canEdit = useGanttStore(selectCanEdit)
  const openEditor = useGanttStore((s) => s.openEditor)

  return (
    <div
      data-testid="gantt-empty"
      className="pointer-events-auto sticky w-fit max-w-xl bg-paper brutal shadow-brutal-lg p-6 space-y-4"
      style={{ left: SIDEBAR_WIDTH + 16 }}
    >
      <h2 className="text-2xl">Ce projet est vide</h2>
      {canEdit ? (
        <>
          <p className="font-bold">
            Pose une première tâche, un jalon ou un groupe. Le diagramme se construit ensuite de
            proche en proche.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => openEditor({ mode: 'create', parentId: null, type: 'task' })}>Première tâche</Button>
            <Button variant="secondary" onClick={() => openEditor({ mode: 'create', parentId: null, type: 'milestone' })}>Premier jalon</Button>
            <Button variant="secondary" onClick={() => openEditor({ mode: 'create', parentId: null, type: 'group' })}>Premier groupe</Button>
          </div>
          <ul className="space-y-1 border-t-[3px] border-ink pt-3 font-mono text-xs text-ink-soft">
            <li>↳ sur une ligne enchaîne la suivante juste après elle.</li>
            <li>Glisse une barre pour la déplacer, ses bords pour l’allonger.</li>
            <li>Tire la pastille du bord droit d’une barre vers une autre pour les lier.</li>
          </ul>
        </>
      ) : (
        <p className="font-bold">Personne n’y a encore ajouté de tâche.</p>
      )}
    </div>
  )
}
