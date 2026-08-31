import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { signOut } from '@/app/(app)/projects/actions'

export interface AppHeaderProps { displayName: string; color: string; avatarUrl: string | null }

export function AppHeader({ displayName, color, avatarUrl }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b-[3px] border-ink bg-yellow px-6 py-3">
      <Link href="/projects" className="font-display text-2xl uppercase brutal-focus">BradGantt</Link>
      <div className="flex items-center gap-4">
        <span className="font-bold hidden sm:inline">{displayName}</span>
        <Avatar name={displayName} color={color} src={avatarUrl} size="sm" />
        <form action={signOut}><Button variant="secondary" size="sm" type="submit">Déconnexion</Button></form>
      </div>
    </header>
  )
}
