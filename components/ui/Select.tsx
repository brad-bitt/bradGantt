import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface SelectOption { value: string; label: string }
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={selectId} className="font-bold uppercase text-sm">{label}</label>}
      {/* `appearance-none` retire le chevron natif : sans le remettre, une liste déroulante est
          rigoureusement indiscernable d'un champ de saisie — même bordure, même fond, même
          hauteur. Le glyphe est décoratif et ne capte pas le pointeur, le clic va au select. */}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn('w-full bg-paper border-[3px] border-ink pl-3 pr-9 py-2 font-ui brutal-focus-field appearance-none', className)}
          {...props}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-sm" aria-hidden>▾</span>
      </div>
    </div>
  )
})
