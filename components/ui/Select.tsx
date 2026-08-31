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
      <select
        ref={ref}
        id={selectId}
        className={cn('bg-paper border-[3px] border-ink px-3 py-2 font-ui brutal-focus appearance-none', className)}
        {...props}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
})
