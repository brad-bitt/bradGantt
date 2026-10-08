import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> { label: string }

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <label htmlFor={inputId} className="inline-flex items-center gap-2 cursor-pointer select-none">
      {/* `type="checkbox"` après `{...props}` : ce composant DOIT toujours rendre une
          case à cocher, quel que soit ce qu'un appelant fournirait par erreur via
          `props.type`. Un attribut posé avant le spread serait silencieusement écrasé.
          Case native : `accent-color` la peint en encre, et le navigateur garantit une coche
          lisible dans les deux thèmes — ce qu'un `appearance-none` redessiné ne faisait pas la
          nuit. */}
      <input ref={ref} id={inputId}
        className={cn('size-[18px] shrink-0 rounded-[4px] accent-ink focus-ring', className)} {...props} type="checkbox" />
      <span className="text-sm font-medium">{label}</span>
    </label>
  )
})
