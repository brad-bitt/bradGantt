'use client'
import { useEffect, useId, type ReactNode } from 'react'
import { Button } from './Button'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="bg-paper border-[3px] border-ink shadow-brutal-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b-[3px] border-ink px-5 py-3 bg-yellow">
          <h2 id={titleId} className="text-xl">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">✕</Button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-3 border-t-[3px] border-ink px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}
