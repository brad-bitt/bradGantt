'use client'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type MenuEntry =
  | { kind?: 'item'; id: string; label: string; onSelect: () => void; danger?: boolean }
  /** Intitulé non interactif : un nom d'utilisateur, ou « Déplacer vers… » au-dessus de ses cibles. */
  | { kind: 'heading'; id: string; label: ReactNode }

export interface MenuProps {
  /** Nom accessible du déclencheur et de la liste : « ⋯ » seul ne dit rien à un lecteur d'écran. */
  label: string
  entries: MenuEntry[]
  /** Contenu visible du déclencheur. « ⋯ » par défaut. */
  trigger?: ReactNode
  triggerClassName?: string
  /** Bord du déclencheur sur lequel la liste s'aligne. */
  align?: 'start' | 'end'
  /** `header` : le focus passe au jaune, l'encre ne se voit pas sur la bande noire. */
  tone?: 'default' | 'header'
  className?: string
}

/** Marge minimale entre la liste et le bord de la fenêtre, en pixels. */
const EDGE = 8
/** Écart entre le déclencheur et la liste. */
const GAP = 4

const stop = (e: SyntheticEvent) => e.stopPropagation()

/**
 * Menu « ⋯ » : un déclencheur discret (niveau 3) et une liste de commandes posée dessous.
 *
 * La liste passe par un PORTAIL dans `body`, en `position: fixed`. Rendue en place, elle était
 * rognée par le défilement des colonnes du kanban et passait SOUS la carte suivante dès que la
 * sienne était translucide (une carte terminée est à 75 % d'opacité, donc un contexte
 * d'empilement à elle). Les événements React traversent quand même le portail : le `span`
 * englobant les arrête, si bien qu'un clic dans le menu n'arme pas le glisser d'une carte de
 * ticket, n'ouvre pas son éditeur au double-clic, et ne suit pas le lien d'une carte de projet.
 */
export function Menu({ label, entries, trigger, triggerClassName, align = 'end', tone = 'default', className }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    // `preventScroll` : sur un téléphone, rendre le focus pouvait faire défiler la page, et le
    // défilement referme… le menu suivant.
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const t = triggerRef.current
    const l = listRef.current
    if (!t || !l) return
    // Mesure AVANT peinture : la liste ne s'affiche jamais à sa position provisoire (0, 0).
    const r = t.getBoundingClientRect()
    const { width, height } = l.getBoundingClientRect()
    const left = align === 'end' ? r.right - width : r.left
    const below = r.bottom + GAP
    setPos({
      left: Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE)),
      // Pas la place en dessous (une carte en bas d'écran) : la liste se pose au-dessus.
      top: below + height > window.innerHeight - EDGE ? Math.max(EDGE, r.top - GAP - height) : below,
    })
    l.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
  }, [open, align])

  useEffect(() => {
    if (!open) return
    // Clic ailleurs, défilement, redimensionnement : la liste fixe se détacherait de son
    // déclencheur, on la referme plutôt que de la laisser flotter.
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close(false)
    }
    const onMove = () => close(false)
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, close])

  function onListKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    if (items.length === 0) return
    const i = items.indexOf(document.activeElement as HTMLElement)
    const go = (n: number) => {
      e.preventDefault()
      items[(n + items.length) % items.length].focus({ preventScroll: true })
    }
    switch (e.key) {
      case 'ArrowDown': go(i + 1); break
      case 'ArrowUp': go(i <= 0 ? items.length - 1 : i - 1); break
      case 'Home': go(0); break
      case 'End': go(items.length - 1); break
      case 'Escape':
        // Arrêtée ici : sans ça, l'Échap du Gantt (désélection) ou d'une fenêtre ouverte en
        // dessous partirait avec, et un seul appui fermerait deux choses.
        e.preventDefault()
        e.stopPropagation()
        close(true)
        break
      case 'Tab':
        // La liste vit en fin de `body` : laisser Tab avancer sortirait de la page.
        e.preventDefault()
        close(true)
        break
    }
  }

  const dots = trigger === undefined

  return (
    <span className={cn('relative inline-flex', className)} onPointerDown={stop} onClick={stop} onDoubleClick={stop}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cn(
          'inline-flex items-center justify-center',
          tone === 'header' ? 'brutal-focus-header' : 'brutal-focus',
          // Une seule taille pour tous les « ⋯ » : un `size-*` ajouté par l'appelant entrerait en
          // conflit avec celui-ci, et l'ordre des classes générées déciderait au hasard.
          dots && 'size-7 text-base font-bold leading-none hover:bg-yellow hover:text-on-data',
          triggerClassName,
        )}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) }
        }}
      >
        {trigger ?? <span aria-hidden>⋯</span>}
      </button>
      {open && createPortal(
        <div
          ref={listRef}
          id={listId}
          role="menu"
          aria-label={label}
          // Surface posée : bordure, fond papier, ombre brutale (spec §3). `text-ink` explicite :
          // ouvert depuis l'en-tête, la liste hériterait sinon de l'encre crème de la bande noire.
          className="fixed z-50 min-w-52 border-[3px] border-ink bg-paper py-1 text-ink shadow-brutal"
          style={{ top: pos.top, left: pos.left }}
          onKeyDown={onListKeyDown}
          onPointerDown={stop}
          onClick={stop}
          onDoubleClick={stop}
        >
          {entries.map((entry) =>
            entry.kind === 'heading' ? (
              <div key={entry.id} role="presentation" className="px-4 pb-1 pt-2 font-mono text-xs text-ink-soft">
                {entry.label}
              </div>
            ) : (
              <button
                key={entry.id}
                type="button"
                role="menuitem"
                // Hors de l'ordre de tabulation : on circule aux flèches, Tab sort du menu.
                tabIndex={-1}
                onClick={() => { close(true); entry.onSelect() }}
                className={cn(
                  'block w-full px-4 py-2 text-left text-sm font-bold outline-none',
                  entry.danger
                    // Destructif sobre au repos, aplat rouge seulement sous le pointeur ou le focus.
                    ? 'text-danger hover:bg-danger hover:text-on-data focus:bg-danger focus:text-on-data'
                    : 'hover:bg-yellow hover:text-on-data focus:bg-yellow focus:text-on-data',
                )}
              >
                {entry.label}
              </button>
            ),
          )}
        </div>,
        document.body,
      )}
    </span>
  )
}
