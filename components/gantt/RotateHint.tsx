'use client'
import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'bradgantt.rotate-hint.dismissed'

/**
 * Sur un téléphone tenu en portrait, le diagramme reste consultable mais étroit : la colonne
 * des tâches et la frise se partagent moins de 400 px. Ce bandeau suggère de tourner l'appareil
 * — en paysage, la vue retrouve sa mise en page de bureau et tout devient éditable à l'aise.
 *
 * Il n'existe qu'en portrait ET sur un écran étroit (media queries CSS, pas de mesure JS), et
 * une fois fermé il ne revient pas de la session : un conseil qu'on redonne à chaque page
 * devient un bruit qu'on n'entend plus.
 */
export function RotateHint() {
  // `null` tant que le composant n'est pas monté : le serveur ne connaît pas sessionStorage.
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(DISMISSED_KEY) === '1') } catch { setDismissed(false) }
  }, [])

  if (dismissed !== false) return null

  function dismiss() {
    setDismissed(true)
    try { sessionStorage.setItem(DISMISSED_KEY, '1') } catch {}
  }

  return (
    <div
      data-testid="rotate-hint"
      role="status"
      className="hidden portrait:flex sm:portrait:hidden shrink-0 items-center gap-3 border-b-[3px] border-ink bg-yellow px-3 py-2 text-on-data"
    >
      <span aria-hidden className="text-xl leading-none">⟳</span>
      <p className="flex-1 text-sm font-bold leading-tight">
        Pour modifier le diagramme à l’aise, tourne ton téléphone à l’horizontale.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer ce conseil"
        className="shrink-0 border-[3px] border-ink bg-paper px-2 py-0.5 font-mono text-xs font-bold text-ink brutal-focus"
      >
        OK
      </button>
    </div>
  )
}
