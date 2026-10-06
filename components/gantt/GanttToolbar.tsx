'use client'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ZoomControls } from './ZoomControls'

export function GanttToolbar() {
  const members = useGanttStore((s) => s.members)
  const myRole = useGanttStore((s) => s.myRole)
  const canEdit = useGanttStore(selectCanEdit)
  const openEditor = useGanttStore((s) => s.openEditor)
  const setMembersDialogOpen = useGanttStore((s) => s.setMembersDialogOpen)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b-[3px] border-ink bg-paper px-3 py-2 sm:gap-4 sm:px-6 sm:py-3 short:py-1">
      {/* Nom du projet, retour à la liste et lien Tickets sont montés dans l'en-tête : les
          répéter ici donnerait deux titres et deux liens identiques sur le même écran. */}
      {canEdit ? <Badge color={myRole === 'owner' ? 'violet' : 'blue'}>{myRole}</Badge> : <Badge color="cyan">Lecture seule</Badge>}
      <button type="button" onClick={() => setMembersDialogOpen(true)} aria-label="Membres" className="flex items-center gap-2 brutal-focus">
        <span className="flex -space-x-2">
          {members.map((m) => <Avatar key={m.userId} name={m.displayName} color={m.color} src={m.avatarUrl} size="sm" />)}
        </span>
        <span className="font-bold text-sm underline">Membres</span>
      </button>
      <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
        <ZoomControls />
        {canEdit && (
          <>
            <Button size="sm" onClick={() => openEditor({ mode: 'create', parentId: null, type: 'task' })}>+ Tâche</Button>
            <Button size="sm" variant="secondary" onClick={() => openEditor({ mode: 'create', parentId: null, type: 'milestone' })}>+ Jalon</Button>
            <Button size="sm" variant="secondary" onClick={() => openEditor({ mode: 'create', parentId: null, type: 'group' })}>+ Groupe</Button>
          </>
        )}
      </div>
    </div>
  )
}
