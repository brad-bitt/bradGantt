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
      {label && <label htmlFor={selectId} className="font-medium text-sm">{label}</label>}
      {/* `appearance-none` retire le chevron natif : sans le remettre, une liste déroulante est
          rigoureusement indiscernable d'un champ de saisie — même bordure, même fond, même
          hauteur. Le glyphe est décoratif et ne capte pas le pointeur, le clic va au select. */}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn('h-10 w-full rounded-control border border-line bg-surface pl-3 pr-9 font-ui text-base focus-ring focus:border-ink appearance-none', className)}
          {...props}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-soft" aria-hidden>▾</span>
      </div>
    </div>
  )
})
