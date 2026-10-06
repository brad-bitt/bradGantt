'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export type ProjectTab = 'gantt' | 'tickets' | 'membres'

/** Onglet désigné par une URL. Le Gantt est la RACINE du projet : un préfixe l'allumerait partout. */
export function currentTab(pathname: string, projectId: string): ProjectTab | null {
  const base = `/projects/${projectId}`
  if (pathname === base) return 'gantt'
  if (pathname.startsWith(`${base}/tickets`)) return 'tickets'
  if (pathname.startsWith(`${base}/membres`)) return 'membres'
  return null
}

/**
 * Les trois sections d'un projet. Composant client pour la seule raison de `usePathname` :
 * l'en-tête qui l'accueille reste rendu côté serveur.
 *
 * L'onglet Tickets n'existe, tickets désactivés, que pour le PROPRIÉTAIRE : la page renvoie une
 * 404 à tout autre membre, et offrir une porte qui se referme serait pire que ne rien offrir.
 */
export function ProjectTabs({ projectId, ticketsEnabled, isOwner, className }: {
  projectId: string
  ticketsEnabled: boolean
  isOwner: boolean
  className?: string
}) {
  const current = currentTab(usePathname(), projectId)
  const base = `/projects/${projectId}`
  const tabs: { id: ProjectTab; label: string; href: string }[] = [
    { id: 'gantt', label: 'Gantt', href: base },
    ...(ticketsEnabled || isOwner ? [{ id: 'tickets' as const, label: 'Tickets', href: `${base}/tickets` }] : []),
    { id: 'membres', label: 'Membres', href: `${base}/membres` },
  ]

  return (
    // `overflow-x-auto` : sur un téléphone, la rangée des onglets défile plutôt que d'élargir la page.
    <nav aria-label="Sections du projet" className={cn('flex h-10 items-stretch gap-5 overflow-x-auto sm:h-14', className)}>
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={current === t.id ? 'page' : undefined}
          className={cn(
            // Souligné de 3 px, jaune pour le courant : le jaune ne signifie que « actif ».
            'flex shrink-0 items-center border-b-[3px] text-sm font-bold brutal-focus-header',
            current === t.id ? 'border-yellow text-on-header' : 'border-transparent text-on-header/70 hover:text-on-header',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
