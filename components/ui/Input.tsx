import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={inputId} className="font-bold uppercase text-sm">{label}</label>}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn('bg-paper border-[3px] border-ink px-3 py-2 font-ui brutal-focus placeholder:text-ink/40', error && 'border-danger', className)}
        {...props}
      />
      {error && <p id={errorId} role="alert" className="text-danger text-sm font-bold">{error}</p>}
    </div>
  )
})
