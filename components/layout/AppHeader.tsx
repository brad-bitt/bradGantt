import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { signOut } from '@/app/(app)/projects/actions'
import { ThemeToggle } from './ThemeToggle'

export interface AppHeaderProps { displayName: string; color: string; avatarUrl: string | null }

export function AppHeader({ displayName, color, avatarUrl }: AppHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b-[3px] border-ink bg-header px-3 py-3 text-on-header sm:px-6">
      {/* Le seul jaune voyant de l'application : un filet sous le mot-marque. Il devient une
          signature au lieu d'un aplat, et le registre « jaune = actif » reste intact ailleurs. */}
      <Link href="/projects" className="font-display text-xl uppercase brutal-focus decoration-yellow decoration-4 underline underline-offset-4 sm:text-2xl">BradGantt</Link>
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
