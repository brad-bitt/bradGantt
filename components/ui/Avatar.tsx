import { cn } from '@/lib/utils'

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export interface AvatarProps { name: string; color: string; src?: string | null; size?: 'sm' | 'md'; me?: boolean; className?: string }

/**
 * Les avatars des autres sont en encre (spec §4) : une couleur par membre mettait un sur six en or,
 * qui ne signifie que « actif ». `color` reste dans l'API pour les appelants ; l'avatar de
 * l'utilisateur (`me`) est en or. Une prop plutôt qu'une classe : `cn` ne fusionne pas deux `bg-*`.
 */
export function Avatar({ name, src, size = 'md', me = false, className }: AvatarProps) {
  const dim = size === 'sm' ? 'size-7 text-xs' : 'size-10 text-sm'
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} title={name} className={cn('rounded-full object-cover', dim, className)} />
  }
  return (
    <span title={name}
      className={cn('inline-flex items-center justify-center rounded-full font-ui font-semibold', me ? 'bg-accent text-black/80' : 'bg-ink text-paper', dim, className)}>
      {initials(name)}
    </span>
  )
}
