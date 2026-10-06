import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, id, rows = 4, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const errorId = `${fieldId}-error`
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={fieldId} className="font-bold uppercase text-sm">{label}</label>}
      {/* Même discipline que `Input` : aria-invalid/aria-describedby posés APRÈS le spread,
          pour qu'un appelant ne puisse pas les écraser silencieusement quand une erreur est
          affichée, tout en laissant passer sa propre valeur quand il n'y en a pas. */}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className={cn('bg-paper border-[3px] border-ink px-3 py-2 font-ui brutal-focus-field placeholder:text-ink/40', error && 'border-danger', className)}
        {...props}
        aria-invalid={error ? 'true' : props['aria-invalid']}
        aria-describedby={error ? errorId : props['aria-describedby']}
      />
      {error && <p id={errorId} role="alert" className="text-danger text-sm font-bold">{error}</p>}
    </div>
  )
})
