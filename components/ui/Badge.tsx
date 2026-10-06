import { cn } from '@/lib/utils'

export type BadgeColor = 'violet' | 'blue' | 'cyan' | 'rose' | 'emerald' | 'yellow' | 'ink' | 'paper'

// Texte `on-data` (encre noire fixe) sur toute couleur de DONNÉE : les couleurs sont calées assez
// claires pour ça, et le thème sombre ne doit pas y poser une encre crème. `paper` est l'exception :
// c'est une couleur de STRUCTURE (le statut « À faire »), son texte suit donc le thème.
const colors: Record<BadgeColor, string> = {
  violet: 'bg-violet text-on-data',
  blue: 'bg-blue text-on-data',
  cyan: 'bg-cyan text-on-data',
  rose: 'bg-rose text-on-data',
  emerald: 'bg-emerald text-on-data',
  yellow: 'bg-yellow text-on-data',
  ink: 'bg-ink text-cream',
  paper: 'bg-paper text-ink',
}

export function Badge({ color = 'ink', className, children }: { color?: BadgeColor; className?: string; children: React.ReactNode }) {
  // Casse mixte et police d'interface : un badge de rôle ou de statut est un mot, pas un chiffre.
  return (
    <span className={cn('inline-block border-[3px] border-ink px-2 py-0.5 text-xs font-bold', colors[color], className)}>
      {children}
    </span>
  )
}
