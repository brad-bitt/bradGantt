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
      {/* aria-invalid/aria-describedby après `{...props}` : quand `error` est posé, ils
          doivent toujours refléter fidèlement l'état du champ (et pointer vers le
          message rendu juste en dessous) — un appelant ne doit jamais pouvoir les
          écraser silencieusement via un spread. Sans erreur, on retombe sur la valeur
          éventuellement fournie par l'appelant (`props['aria-describedby']` pour un
          texte d'aide, par ex.) plutôt que sur `undefined` : un objet JSX qui pose une
          clé après le spread l'emporte même à `undefined`, ce qui effacerait
          silencieusement cette valeur — exactement ce que D3 voulait éviter. `type`
          reste entièrement porté par `props` : ce composant n'impose aucune valeur par
          défaut (le plan suivant lui passera type="date"/type="number" en masse). */}
      <input
        ref={ref}
        id={inputId}
        className={cn('bg-paper border-[3px] border-ink px-3 py-2 font-ui brutal-focus-field placeholder:text-ink/40', error && 'border-danger', className)}
        {...props}
        aria-invalid={error ? 'true' : props['aria-invalid']}
        aria-describedby={error ? errorId : props['aria-describedby']}
      />
      {error && <p id={errorId} role="alert" className="text-danger text-sm font-bold">{error}</p>}
    </div>
  )
})
