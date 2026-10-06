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
  const projectId = useGanttStore((s) => s.projectId)
  const ticketsEnabled = useGanttStore((s) => s.ticketsEnabled)
  const setMembersDialogOpen = useGanttStore((s) => s.setMembersDialogOpen)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b-[3px] border-ink bg-paper px-3 py-2 sm:gap-4 sm:px-6 sm:py-3 short:py-1">
      <Link href="/projects" className="font-mono text-sm underline brutal-focus">← Projets</Link>
      <h1 className="max-w-md truncate text-xl sm:text-2xl">{name}</h1>
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
      <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Affiché SEULEMENT quand les tickets sont activés : la page renvoie un 404 à tout
            membre non propriétaire d'un projet sans backlog, et offrir une porte qui se referme
            serait pire que de ne rien offrir. */}
        {ticketsEnabled && (
          <Link href={`/projects/${projectId}/tickets`} className="font-bold uppercase text-sm underline brutal-focus">
            Tickets
          </Link>
        )}
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
