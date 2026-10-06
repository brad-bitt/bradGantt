import Link from 'next/link'
import type { Member, Role } from '@/lib/gantt/types'
import { Avatar } from '@/components/ui/Avatar'
import { ProjectMenu } from '@/components/project/ProjectMenu'
import { Mark } from './Logo'
import { ProjectTabs } from './ProjectTabs'
import { UserMenu } from './UserMenu'

/** Au-delà, la pile empiète sur les onglets à 1024 px. */
const MAX_AVATARS = 4

export interface ProjectHeaderProps {
  projectId: string
  projectName: string
  ticketsEnabled: boolean
  myRole: Role
  members: Member[]
}

/**
 * En-tête noir d'un projet : où l'on est (fil d'Ariane), où l'on peut aller (onglets), avec qui
 * (pile d'avatars), et le compte. Composant SERVEUR : seuls les onglets et le menu du compte
 * ont besoin du client.
 *
 * Une seule rangée d'éléments en `flex-wrap` : sous `sm`, les onglets passent en `order-last
 * w-full` et forment la seconde rangée. Les rendre deux fois (une version par gabarit) aurait
 * doublé chaque lien dans le document.
 */
export function ProjectHeader({ projectId, projectName, ticketsEnabled, myRole, members }: ProjectHeaderProps) {
  const isOwner = myRole === 'owner'
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 border-b-[3px] border-ink bg-header px-3 text-on-header sm:h-14 sm:flex-nowrap sm:gap-x-6 sm:px-6">
      {/* Le signe seul ramène à la liste : sur téléphone, le fil d'Ariane se réduit au nom. */}
      <Link href="/projects" aria-label="Mes projets" className="flex h-12 shrink-0 items-center brutal-focus-header sm:h-auto">
        <Mark />
      </Link>
      <nav aria-label="Fil d'Ariane" className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm sm:flex-none">
        <Link href="/projects" className="hidden shrink-0 text-sm text-on-header/70 hover:text-on-header hover:underline brutal-focus-header sm:inline">
          Projets
        </Link>
        <span aria-hidden className="hidden text-on-header/50 sm:inline">/</span>
        {/* Le nom est LE titre de chaque page du projet : un `h1`, tronqué plutôt que replié. */}
        <h1 className="min-w-0 truncate text-base sm:text-lg" title={projectName}>{projectName}</h1>
        {isOwner && (
          // Même menu que la carte de projet : le propriétaire agit sur son projet sans revenir
          // à la liste. `leaveOnDelete` : supprimé d'ici, le projet emporte la page courante.
          <ProjectMenu
            projectId={projectId}
            projectName={projectName}
            ticketsEnabled={ticketsEnabled}
            leaveOnDelete
            tone="header"
            triggerClassName="shrink-0 text-on-header"
          />
        )}
      </nav>
      <ProjectTabs
        projectId={projectId}
        ticketsEnabled={ticketsEnabled}
        isOwner={isOwner}
        className="order-last w-full sm:order-none sm:w-auto"
      />
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {/* Décorative : la liste des membres est l'onglet « Membres », un second lien vers elle
            ferait deux portes au même nom. */}
        <span aria-hidden className="hidden -space-x-2 sm:flex">
          {members.slice(0, MAX_AVATARS).map((m) => (
            <Avatar key={m.userId} name={m.displayName} color={m.color} src={m.avatarUrl} size="sm" />
          ))}
        </span>
        <UserMenu />
      </div>
    </header>
  )
}
