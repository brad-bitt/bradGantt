'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Badge, type BadgeColor } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RenameProjectDialog } from './RenameProjectDialog'
import { deleteProject } from '@/app/(app)/projects/actions'
import { toast } from '@/lib/toast/store'

export interface ProjectListItem { id: string; name: string; role: 'owner' | 'editor' | 'viewer'; createdAt: string }

const roleColor: Record<ProjectListItem['role'], BadgeColor> = { owner: 'violet', editor: 'blue', viewer: 'cyan' }

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const [renaming, setRenaming] = useState(false)
  const [, start] = useTransition()

  function remove() {
    if (!window.confirm(`Supprimer « ${project.name} » et toutes ses tâches ?`)) return
    start(async () => {
      const res = await deleteProject(project.id)
      if (res.error) toast.error(res.error)
    })
  }

  return (
    <article aria-label={project.name} className="bg-paper brutal p-4 flex flex-col gap-2 hover:shadow-brutal-lg transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/projects/${project.id}`} className="font-display text-xl uppercase leading-tight brutal-focus">{project.name}</Link>
        <Badge color={roleColor[project.role]}>{project.role}</Badge>
      </div>
      <p className="font-mono text-xs text-ink-soft">Créé le {format(new Date(project.createdAt), 'd MMM yyyy', { locale: fr })}</p>
      {project.role === 'owner' && (
        <div className="mt-1 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setRenaming(true)}>Renommer</Button>
          <Button size="sm" variant="danger-quiet" onClick={remove}>Supprimer</Button>
        </div>
      )}
      {renaming && <RenameProjectDialog projectId={project.id} currentName={project.name} open onClose={() => setRenaming(false)} />}
    </article>
  )
}
