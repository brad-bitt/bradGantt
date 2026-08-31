'use client'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

const focusableSelectors = [
  'button', 'input', 'textarea', 'select', 'a[href]', '[tabindex]:not([tabindex="-1"])',
]

function getFocusableElements(element: Element): HTMLElement[] {
  return Array.from(element.querySelectorAll(focusableSelectors.join(','))) as HTMLElement[]
}

function getContentFocusableElements(element: Element): HTMLElement[] {
  // Chercher d'abord dans le contenu principal (pas le header)
  const content = element.querySelector('div[class*="px-5 py-4"]')
  if (content) {
    return Array.from(content.querySelectorAll(focusableSelectors.join(','))) as HTMLElement[]
  }
  return getFocusableElements(element)
}

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousActiveRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    // Mémoriser l'élément actuellement au focus
    previousActiveRef.current = document.activeElement

    // Gérer l'échap
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // Piéger Tab
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = getFocusableElements(dialogRef.current)
        if (focusables.length === 0) return

        const currentFocus = document.activeElement
        const currentIndex = focusables.indexOf(currentFocus as HTMLElement)

        if (e.shiftKey) {
          // Shift+Tab
          if (currentIndex <= 0) {
            e.preventDefault()
            focusables[focusables.length - 1].focus()
          }
        } else {
          // Tab
          if (currentIndex === focusables.length - 1) {
            e.preventDefault()
            focusables[0].focus()
          }
        }
      }
    }

    window.addEventListener('keydown', onKey)

    // Déplacer le focus dans la modale
    if (dialogRef.current) {
      // Vérifier si un élément a déjà le focus dans la modale (autoFocus)
      const focusables = getFocusableElements(dialogRef.current)
      const alreadyFocused = focusables.some(el => el === document.activeElement)

      if (!alreadyFocused) {
        // Chercher d'abord dans le contenu principal
        const contentFocusables = getContentFocusableElements(dialogRef.current)
        if (contentFocusables.length > 0) {
          contentFocusables[0].focus()
        } else if (focusables.length > 0) {
          focusables[0].focus()
        } else {
          dialogRef.current.focus()
        }
      }
    }

    return () => {
      window.removeEventListener('keydown', onKey)
      // Restaurer le focus sur l'élément précédent
      if (previousActiveRef.current && previousActiveRef.current instanceof HTMLElement && document.contains(previousActiveRef.current)) {
        previousActiveRef.current.focus()
      }
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="bg-paper border-[3px] border-ink shadow-brutal-xl w-full max-w-lg outline-none"
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
