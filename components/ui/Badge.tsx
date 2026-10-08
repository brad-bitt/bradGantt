import { cn } from '@/lib/utils'

export type BadgeColor = 'violet' | 'blue' | 'cyan' | 'rose' | 'emerald' | 'accent' | 'ink' | 'paper'

// Une couleur de DONNÉES se porte en teinte pâle, texte en encre du thème — comme une barre du
// Gantt (spec §3), à la même part de couleur jour et nuit. `ink` est le
// seul aplat ; `paper` est la couleur de STRUCTURE du statut « À faire ».
const colors: Record<BadgeColor, string> = {
  violet: 'bg-violet/30 border-violet/40 text-ink',
  blue: 'bg-blue/30 border-blue/40 text-ink',
  cyan: 'bg-cyan/30 border-cyan/40 text-ink',
  rose: 'bg-rose/30 border-rose/40 text-ink',
  emerald: 'bg-emerald/30 border-emerald/40 text-ink',
  accent: 'bg-accent-soft border-accent/40 text-ink',
  ink: 'bg-ink border-ink text-paper',
  paper: 'bg-surface border-line text-ink',
}

export function Badge({ color = 'ink', className, children }: { color?: BadgeColor; className?: string; children: React.ReactNode }) {
  // Casse mixte et police d'interface : un badge de rôle ou de statut est un mot, pas un chiffre.
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', colors[color], className)}>
      {children}
    </span>
  )
}
