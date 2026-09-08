'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type Theme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'bradgantt.theme'

/**
 * Script exécuté AVANT le premier rendu, inséré tel quel par le layout racine : il pose
 * `data-theme` sur <html> d'après le choix enregistré, sinon d'après le réglage du système.
 * Sans lui, une page sombre s'afficherait claire le temps que React se monte — un éclair blanc
 * à chaque navigation complète.
 *
 * Tout est dans un `try` : `localStorage` lève en navigation privée sur certains navigateurs,
 * et un thème qui ne se charge pas vaut mieux qu'une page qui ne se charge pas.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`

function current(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

/**
 * Bascule clair / sombre. Un choix explicite est enregistré ; tant qu'il n'y en a pas, la page
 * suit le système, y compris quand il change en cours de session.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // `null` tant que le composant n'est pas monté : le serveur ne connaît pas le thème, et
  // rendre « Clair » puis corriger à l'hydratation ferait clignoter le libellé.
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    setTheme(current())
    const media = matchMedia('(prefers-color-scheme: dark)')
    const follow = () => {
      let stored: string | null = null
      try { stored = localStorage.getItem(THEME_STORAGE_KEY) } catch {}
      if (stored) return
      const next: Theme = media.matches ? 'dark' : 'light'
      applyTheme(next)
      setTheme(next)
    }
    media.addEventListener('change', follow)
    return () => media.removeEventListener('change', follow)
  }, [])

  function toggle() {
    const next: Theme = current() === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
    try { localStorage.setItem(THEME_STORAGE_KEY, next) } catch {}
  }

  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? 'Passer au thème clair' : 'Passer au thème sombre'}
      title={dark ? 'Thème clair' : 'Thème sombre'}
      className={cn(
        'inline-flex h-8 items-center gap-2 border-[3px] border-current px-2 font-mono text-xs font-bold uppercase brutal-focus',
        className,
      )}
    >
      {/* Le glyphe seul suffit à reconnaître la commande ; le mot n'apparaît qu'une fois le
          thème connu, pour ne pas afficher un libellé faux le temps du montage. */}
      <span aria-hidden className="text-base leading-none">{dark ? '☾' : '☼'}</span>
      {theme && <span className="hidden sm:inline">{dark ? 'Sombre' : 'Clair'}</span>}
    </button>
  )
}
