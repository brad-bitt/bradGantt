import Link from 'next/link'
import { UserMenu } from './UserMenu'
import { Wordmark } from './Logo'

/**
 * En-tête HORS projet (la liste « Mes projets ») : la marque, qui ramène à la liste, et le menu
 * du compte. L'en-tête d'un projet est `ProjectHeader`.
 */
export function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-paper px-4 sm:px-6">
      {/* Signe + nom, sans soulignement : l'or ne signifie que « actif ». */}
      <Link href="/projects" className="rounded-control focus-ring"><Wordmark /></Link>
      <UserMenu />
    </header>
  )
}
