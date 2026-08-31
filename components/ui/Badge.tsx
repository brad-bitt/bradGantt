import { cn } from '@/lib/utils'

export type BadgeColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple' | 'ink'

const colors: Record<BadgeColor, string> = {
  yellow: 'bg-yellow text-ink',
  pink: 'bg-pink text-ink',
  blue: 'bg-blue text-paper',
  green: 'bg-green text-ink',
  orange: 'bg-orange text-ink',
  purple: 'bg-purple text-paper',
  ink: 'bg-ink text-paper',
}

export function Badge({ color = 'yellow', className, children }: { color?: BadgeColor; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-block border-[3px] border-ink px-2 py-0.5 font-mono text-xs font-bold uppercase', colors[color], className)}>
      {children}
    </span>
  )
}
