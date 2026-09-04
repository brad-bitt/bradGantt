import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'danger' | 'danger-quiet' | 'ghost'
type Size = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-cream brutal brutal-press',
  secondary: 'bg-paper text-ink brutal brutal-press',
  danger: 'bg-danger text-paper brutal brutal-press',
  /* Destructif, mais pas criard au repos. Sur une liste de projets, « Supprimer » en aplat
     rouge était l'élément le plus visible de l'écran alors que c'est l'action la plus rare :
     l'accent va à la confirmation, pas à la tentation. */
  'danger-quiet': 'bg-paper text-danger brutal brutal-press hover:bg-danger hover:text-paper',
  ghost: 'bg-transparent text-ink border-[3px] border-transparent hover:border-ink',
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
        'inline-flex items-center justify-center gap-2 font-ui font-bold uppercase tracking-wide brutal-focus disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})
