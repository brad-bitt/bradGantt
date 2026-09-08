import { cn } from '@/lib/utils'

/**
 * Le signe de BradGantt : trois barres décalées comme un escalier, sur un carré d'encre — un
 * diagramme de Gantt réduit à ce qui le fait reconnaître. Les couleurs sont les trois premières
 * du registre DONNÉES ; pas de jaune, réservé à l'état actif.
 *
 * Le cadre est d'un crème FIXE, pas du jeton `cream` : sur l'en-tête (toujours sombre) comme sur
 * un onglet de navigateur sombre, c'est lui qui détache le carré du fond. Sur une surface claire
 * il disparaît, ce qui ne gêne pas — le carré noir se suffit.
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
      <rect width="64" height="64" fill="#111111" />
      <rect x="2" y="2" width="60" height="60" fill="none" stroke="#FDF6E3" strokeWidth="4" />
      <rect x="12" y="14" width="26" height="9" fill="#5B9DFF" />
      <rect x="22" y="28" width="26" height="9" fill="#FF8A3D" />
      <rect x="32" y="42" width="20" height="9" fill="#FF6FA3" />
    </svg>
  )
}

/**
 * Signe + nom. Le nom est en casse mixte et sans le filet jaune d'avant : « BRADGANTT » en
 * capitales soulignées se lisait comme un cri, et la majuscule du G suffit à séparer les deux
 * mots. Le titre parent met les `h1` en capitales, d'où `normal-case`.
 */
export function Wordmark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const mark = { sm: 22, md: 28, lg: 44 }[size]
  const text = { sm: 'text-lg', md: 'text-xl sm:text-2xl', lg: 'text-4xl' }[size]
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Mark size={mark} />
      <span className={cn('font-display normal-case tracking-tight', text)}>BradGantt</span>
    </span>
  )
}
