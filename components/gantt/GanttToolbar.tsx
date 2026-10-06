'use client'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import type { TaskType } from '@/lib/gantt/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { ZoomControls } from './ZoomControls'

/**
 * Barre d'outils de VUE. Nom du projet, rôle, membres et lien Tickets sont dans l'en-tête ; ne
 * restent ici que les commandes qui agissent sur le diagramme : regarder (zoom, aujourd'hui) à
 * gauche, créer à droite.
 */
export function GanttToolbar() {
  const canEdit = useGanttStore(selectCanEdit)
  const openEditor = useGanttStore((s) => s.openEditor)
  const today = useGanttStore((s) => s.today)
  const scrollToDate = useGanttStore((s) => s.scrollToDate)
  const create = (type: TaskType) => openEditor({ mode: 'create', parentId: null, type })

  return (
    <div className="flex shrink-0 items-center gap-2 border-b-[3px] border-ink bg-paper px-3 py-2 sm:gap-3 sm:px-6 short:py-1">
      <ZoomControls />
      {/* Sur téléphone, la barre ne garde que J / S / M et « + » : « Aujourd'hui » n'y tient pas.
          `max-sm:hidden` et non `hidden sm:inline-flex` : le `inline-flex` de base du Button est
          émis après `hidden` et l'emporterait, le bouton resterait visible. */}
      <Button size="sm" variant="secondary" className="max-sm:hidden" onClick={() => scrollToDate(today)}>
        Aujourd&apos;hui
      </Button>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {canEdit ? (
          <>
            {/* Ordre de lecture : les secondaires d'abord, le principal au bout de la barre,
                là où l'œil finit sa course. */}
            <span className="hidden items-center gap-2 sm:flex sm:gap-3">
              <Button size="sm" variant="secondary" onClick={() => create('milestone')}>+ Jalon</Button>
              <Button size="sm" variant="secondary" onClick={() => create('group')}>+ Groupe</Button>
              <Button size="sm" onClick={() => create('task')}>+ Tâche</Button>
            </span>
            {/* Sur téléphone, trois boutons ne tiennent pas à côté du zoom : un seul « + »
                principal, qui ouvre le choix. */}
            <Menu
              label="Ajouter"
              className="sm:hidden"
              trigger={<span aria-hidden className="text-lg leading-none">+</span>}
              triggerClassName="size-8 bg-ink text-cream brutal brutal-press font-bold"
              entries={[
                { id: 'task', label: 'Tâche', onSelect: () => create('task') },
                { id: 'milestone', label: 'Jalon', onSelect: () => create('milestone') },
                { id: 'group', label: 'Groupe', onSelect: () => create('group') },
              ]}
            />
          </>
        ) : (
          <Badge color="cyan">Lecture seule</Badge>
        )}
      </div>
    </div>
  )
}
