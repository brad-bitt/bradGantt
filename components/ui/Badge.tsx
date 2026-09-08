import { cn } from '@/lib/utils'

export type BadgeColor = 'violet' | 'blue' | 'cyan' | 'rose' | 'emerald' | 'yellow' | 'ink'

// Texte `on-data` (encre noire fixe) sur toute couleur : les couleurs sont calées assez claires
// pour ça, l'uniformité évite qu'un badge paraisse plus « important » qu'un autre, et le thème
// sombre ne doit pas y poser une encre crème.
const colors: Record<BadgeColor, string> = {
  violet: 'bg-violet text-on-data',
  blue: 'bg-blue text-on-data',
  cyan: 'bg-cyan text-on-data',
  rose: 'bg-rose text-on-data',
  emerald: 'bg-emerald text-on-data',
  yellow: 'bg-yellow text-on-data',
  ink: 'bg-ink text-cream',
}

export function Badge({ color = 'ink', className, children }: { color?: BadgeColor; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-block border-[3px] border-ink px-2 py-0.5 font-mono text-xs font-bold uppercase', colors[color], className)}>
      {children}
    </span>
  )
}
