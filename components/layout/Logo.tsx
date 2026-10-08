import { cn } from '@/lib/utils'

/**
 * Le signe de BradGantt : trois barres décalées comme un escalier, sur un carré d'encre — un
 * diagramme de Gantt réduit à ce qui le fait reconnaître. Les couleurs sont les trois premières
 * du registre DONNÉES ; pas d'or, réservé à l'état actif. C'est le seul endroit, avec l'image
 * d'aperçu, où ces couleurs restent en aplat.
 *
 * Carré d'encre nu : le cadre clair qui le détachait du bandeau sombre n'a plus de bandeau d'où
 * se détacher. Sur un onglet de navigateur sombre, le carré se suffit.
 *
 * Même dessin que `app/icon.svg` (favicon) : si l'un change, l'autre suit.
 */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn('shrink-0', className)}
    >
      <rect width="64" height="64" fill="#2A2622" />
      <rect x="12" y="14" width="26" height="9" fill="#5B9DFF" />
      <rect x="22" y="28" width="26" height="9" fill="#FF8A3D" />
      <rect x="32" y="42" width="20" height="9" fill="#FF6FA3" />
    </svg>
  )
}

/**
 * Signe + nom. Le nom en Fraunces, casse mixte, sans soulignement : la majuscule du G suffit à
 * séparer les deux mots.
 */
export function Wordmark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const mark = { sm: 22, md: 28, lg: 44 }[size]
  const text = { sm: 'text-lg', md: 'text-xl sm:text-2xl', lg: 'text-4xl' }[size]
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Mark size={mark} />
      <span className={cn('font-display font-medium tracking-tight', text)}>BradGantt</span>
    </span>
  )
}
