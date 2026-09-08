import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { signOut } from '@/app/(app)/projects/actions'
import { ThemeToggle } from './ThemeToggle'
import { Wordmark } from './Logo'

export interface AppHeaderProps { displayName: string; color: string; avatarUrl: string | null }

export function AppHeader({ displayName, color, avatarUrl }: AppHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b-[3px] border-ink bg-header px-3 py-3 text-on-header sm:px-6">
      {/* Signe + nom, sans le filet jaune d'avant : le jaune ne signifie plus que « actif »,
          partout. C'est le signe qui porte la couleur de la marque. */}
      <Link href="/projects" className="brutal-focus"><Wordmark /></Link>
      <div className="flex items-center gap-2 sm:gap-4">
        <ThemeToggle />
        <span className="font-bold hidden sm:inline">{displayName}</span>
        {/* Nom et avatar disparaissent sur un écran étroit : la déconnexion et le thème doivent tenir. */}
        <span className="hidden sm:block"><Avatar name={displayName} color={color} src={avatarUrl} size="sm" /></span>
        <form action={signOut}><Button variant="secondary" size="sm" type="submit">Déconnexion</Button></form>
      </div>
    </header>
  )
}
