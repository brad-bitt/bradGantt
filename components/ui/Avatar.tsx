import { cn } from '@/lib/utils'

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export interface AvatarProps { name: string; color: string; src?: string | null; size?: 'sm' | 'md'; className?: string }

export function Avatar({ name, color, src, size = 'md', className }: AvatarProps) {
  const dim = size === 'sm' ? 'size-7 text-xs' : 'size-10 text-sm'
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} title={name} className={cn('border-[3px] border-ink object-cover', dim, className)} />
  }
  return (
    <span title={name} style={{ backgroundColor: color }}
      className={cn('inline-flex items-center justify-center border-[3px] border-ink font-display', dim, className)}>
      {initials(name)}
    </span>
  )
}
