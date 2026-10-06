import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'danger-quiet'
type Size = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  /* Niveau 1 : l'action principale, une seule par écran. C'est le seul bouton qui porte l'ombre
     brutale — quand chaque bouton en avait une, aucun ne se détachait. */
  primary: 'bg-ink text-cream brutal brutal-press',
  /* Niveau 2 : même bordure, sans ombre. Il se voit, il ne réclame pas. */
  secondary: 'bg-paper text-ink border-[3px] border-ink hover:bg-band',
  /* Niveau 3 : du texte. La bordure transparente garde la hauteur des deux autres niveaux, pour
     qu'une barre qui les mélange ne sautille pas d'un bouton à l'autre. */
  quiet: 'bg-transparent text-ink border-[3px] border-transparent underline-offset-4 hover:underline',
  /* Réservé au bouton de CONFIRMATION d'une suppression : l'accent va à la décision, pas à la
     tentation. */
  danger: 'bg-danger text-on-data brutal brutal-press',
  /* Destructif au repos : rouge, mais sans aplat. Sur une liste de projets, « Supprimer » en
     aplat rouge était l'élément le plus visible de l'écran alors que c'est l'action la plus rare. */
  'danger-quiet': 'bg-transparent text-danger border-[3px] border-transparent hover:bg-danger hover:text-on-data',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-5 py-2 text-base',
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
        // en deux lignes, c'est la barre qui passe à la ligne. Casse mixte : les capitales sont
        // réservées aux titres (spec §3).
        'inline-flex items-center justify-center gap-2 whitespace-nowrap font-ui font-bold brutal-focus disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})
