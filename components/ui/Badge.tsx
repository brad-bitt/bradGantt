import { cn } from '@/lib/utils'

export type BadgeColor = 'violet' | 'blue' | 'cyan' | 'rose' | 'emerald' | 'yellow' | 'ink'

// Texte encre partout : les couleurs sont calées assez claires pour ça, et l'uniformité
// évite qu'un badge paraisse plus « important » qu'un autre à cause de son contraste.
const colors: Record<BadgeColor, string> = {
  violet: 'bg-violet text-ink',
  blue: 'bg-blue text-ink',
  cyan: 'bg-cyan text-ink',
  rose: 'bg-rose text-ink',
  emerald: 'bg-emerald text-ink',
  yellow: 'bg-yellow text-ink',
  ink: 'bg-ink text-cream',
}

export function Badge({ color = 'ink', className, children }: { color?: BadgeColor; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-block border-[3px] border-ink px-2 py-0.5 font-mono text-xs font-bold uppercase', colors[color], className)}>
      {children}
    </span>
  )
}
