'use client'
import Link from 'next/link'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ZoomControls } from './ZoomControls'

export function GanttToolbar() {
  const name = useGanttStore((s) => s.projectName)
  const members = useGanttStore((s) => s.members)
  const myRole = useGanttStore((s) => s.myRole)
  const canEdit = useGanttStore(selectCanEdit)
  const openEditor = useGanttStore((s) => s.openEditor)
  const setMembersDialogOpen = useGanttStore((s) => s.setMembersDialogOpen)

  return (
    <div className="flex flex-wrap items-center gap-4 border-b-[3px] border-ink bg-paper px-6 py-3">
      <Link href="/projects" className="font-mono text-sm underline brutal-focus">← Projets</Link>
      <h1 className="text-2xl truncate max-w-md">{name}</h1>
      {canEdit ? <Badge color={myRole === 'owner' ? 'violet' : 'blue'}>{myRole}</Badge> : <Badge color="cyan">Lecture seule</Badge>}
      {/* La pile d'avatars devient la porte d'entrée du dialog : c'est déjà là qu'on regarde
          pour savoir qui travaille sur le projet. Le mot « Membres » l'accompagne, une pile
          d'avatars ne se lit pas comme un bouton. */}
      <button type="button" onClick={() => setMembersDialogOpen(true)} aria-label="Membres" className="flex items-center gap-2 brutal-focus">
        <span className="flex -space-x-2">
          {members.map((m) => <Avatar key={m.userId} name={m.displayName} color={m.color} src={m.avatarUrl} size="sm" />)}
        </span>
        <span className="font-bold uppercase text-sm underline">Membres</span>
      </button>
      <div className="ml-auto flex items-center gap-3">
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
