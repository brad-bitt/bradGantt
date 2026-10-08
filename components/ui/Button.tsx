import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'danger-quiet'
type Size = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  /* Niveau 1 : l'action principale, une seule par écran. Le seul aplat d'encre parmi les boutons. */
  primary: 'bg-ink text-paper hover:bg-ink/88',
  /* Niveau 2 : un filet, pas de fond. Il se voit, il ne réclame pas. */
  secondary: 'bg-transparent text-ink border border-line hover:bg-surface hover:border-ink-soft',
  /* Niveau 3 : du texte. La bordure transparente garde la hauteur des deux autres niveaux, pour
     qu'une barre qui les mélange ne sautille pas d'un bouton à l'autre. */
  quiet: 'bg-transparent text-ink border border-transparent hover:bg-surface',
  /* Réservé au bouton de CONFIRMATION d'une suppression : l'accent va à la décision, pas à la
     tentation. Texte blanc fixe : le rouge ne suit pas le thème. */
  danger: 'bg-danger text-white hover:bg-danger/90',
  /* Destructif au repos : rouge, mais sans aplat. */
  'danger-quiet': 'bg-transparent text-danger border border-transparent hover:bg-danger/8',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        // `whitespace-nowrap` : dans une barre qui replie ses boutons, un bouton ne se casse pas
        // en deux lignes, c'est la barre qui passe à la ligne. Casse mixte et graisse 500 : les
        // capitales n'existent plus nulle part (spec §3).
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-ui font-medium focus-ring disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})
