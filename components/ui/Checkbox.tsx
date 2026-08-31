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
      <input ref={ref} id={inputId} type="checkbox"
        className={cn('appearance-none size-5 border-[3px] border-ink bg-paper checked:bg-ink brutal-focus', className)} {...props} />
      <span className="font-bold text-sm">{label}</span>
    </label>
  )
})
