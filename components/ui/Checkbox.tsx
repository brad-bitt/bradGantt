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
          `props.type`. Un attribut posé avant le spread serait silencieusement écrasé. */}
      <input ref={ref} id={inputId}
        className={cn('appearance-none size-5 border-[3px] border-ink bg-paper checked:bg-ink brutal-focus', className)} {...props} type="checkbox" />
      <span className="font-bold text-sm">{label}</span>
    </label>
  )
})
