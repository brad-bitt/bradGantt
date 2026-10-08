'use client'
import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { cn } from '@/lib/utils'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  /**
   * Classe de couleur d'un liseré de 4 px à gauche du titre. La fenêtre d'un ticket y reprend la
   * couleur de son statut, comme la carte d'où elle s'ouvre : on reconnaît l'objet qu'on édite.
   */
  accentClassName?: string
}

const focusableSelectors = [
  'button', 'input', 'textarea', 'select', 'a[href]', '[tabindex]:not([tabindex="-1"])',
]

function getFocusableElements(element: Element): HTMLElement[] {
  return Array.from(element.querySelectorAll(focusableSelectors.join(','))) as HTMLElement[]
}

function getContentFocusableElements(contentElement: HTMLElement | null): HTMLElement[] {
  // Utilisé uniquement pour le focus initial : préférer le contenu principal (pas le
  // header) quand rien n'a déjà le focus (pas d'autoFocus).
  if (contentElement) {
    return Array.from(contentElement.querySelectorAll(focusableSelectors.join(','))) as HTMLElement[]
  }
  return []
}

const stop = (e: SyntheticEvent) => e.stopPropagation()

/**
 * Fenêtre modale, rendue par un PORTAIL dans `body`. Rendue en place, elle héritait de ce qui
 * l'entoure : sous la carte d'un projet (`relative z-10`), son `z-40` ne valait qu'à l'intérieur
 * de la carte et les badges et liens des cartes suivantes passaient par-dessus ; dans l'en-tête
 * d'un projet, elle prenait l'encre crème de la bande noire et son titre disparaissait sur le
 * fond clair. D'où aussi `text-ink` sur le panneau.
 *
 * Les événements React traversent quand même le portail jusqu'au parent React : le fond arrête
 * le pointeur, le clic et le double-clic, sinon un clic dans la fenêtre armerait le glisser d'une
 * carte de ticket ou suivrait le lien d'une carte de projet.
 */
export function Dialog({ open, onClose, title, children, footer, accentClassName }: DialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const previousActiveRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    // Mémoriser l'élément actuellement au focus
    previousActiveRef.current = document.activeElement

    // Gérer l'échap
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // Piéger Tab sur la modale ENTIÈRE (header + contenu + pied), pas seulement le
      // contenu : sinon le bouton "Fermer" du header et les actions passées via `footer`
      // (ex. un futur "Enregistrer"/"Supprimer" en pied de modale) restent injoignables
      // au clavier.
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
        const contentFocusables = getContentFocusableElements(contentRef.current)
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
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 p-0 dark:bg-black/55 sm:items-center sm:p-4"
      onPointerDown={stop}
      onDoubleClick={stop}
      onClick={(e) => { e.stopPropagation(); onClose() }}
    >
      {/* `max-h-full` + colonne flex : une modale plus haute que la fenêtre débordait des deux
          côtés à la fois — l'overlay est en `fixed`, la page ne défile donc pas, et NI le titre
          NI les boutons du pied n'étaient atteignables. Header et pied restent ancrés, seul le
          contenu défile. Sur un téléphone, elle vient du bas, pleine largeur, coins hauts
          arrondis (spec §4). */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="flex max-h-full w-full flex-col rounded-t-dialog border border-line/60 bg-surface text-ink shadow-dialog focus-ring dark:border-line sm:max-w-lg sm:rounded-dialog"
        onClick={(e) => e.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-3 px-6 pb-3 pt-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* Liseré de statut : la fenêtre d'un ticket reprend la couleur de sa carte. */}
            {accentClassName && (
              <span aria-hidden data-testid="dialog-accent" className={cn('w-1 shrink-0 self-stretch rounded-full', accentClassName)} />
            )}
            <h2 id={titleId} className="font-display text-[22px] font-medium leading-tight">{title}</h2>
          </div>
          <Button variant="quiet" size="sm" className="-mr-2 -mt-1" onClick={onClose} aria-label="Fermer">✕</Button>
        </header>
        {/* `min-h-0` : sans lui, un enfant flex refuse de rétrécir sous sa hauteur de contenu et
            `overflow-y-auto` n'a jamais rien à faire défiler. */}
        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-2">{children}</div>
        {/* `flex-wrap` : sur un téléphone, « Supprimer », « Annuler » et « Enregistrer » ne tiennent
            pas sur une rangée ; sans retour à la ligne, `justify-end` poussait « Supprimer » hors
            du panneau, par la gauche. */}
        {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 px-6 pb-6 pt-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
