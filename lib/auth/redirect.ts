const PROTECTED = [/^\/projects(\/|$)/, /^\/invite(\/|$)/]

// Origine de référence arbitraire, jamais exposée : sert uniquement de base pour
// résoudre `next` comme le ferait le parseur WHATWG (celui utilisé par `new URL()`
// dans middleware.ts), afin de détecter toute redirection qui s'échapperait vers
// une autre origine — y compris via des vecteurs non filtrables par liste noire
// (antislash, tabulation/CR/LF littéraux normalisés avant résolution, schéma
// alternatif comme javascript:/data:).
const REFERENCE_ORIGIN = 'https://bradgantt.internal'

export function safeNext(next: string | null | undefined): string {
  if (!next) return '/projects'
  try {
    const resolved = new URL(next, REFERENCE_ORIGIN)
    if (resolved.origin !== REFERENCE_ORIGIN) return '/projects'
    const out = resolved.pathname + resolved.search + resolved.hash
    // Re-validation de la SORTIE, pas seulement de l'entrée : la résolution des
    // segments `..`/`.` du pathname peut faire apparaître un préfixe
    // protocol-relative ('//host/...') sans que l'origine résolue une première
    // fois n'ait bougé (ex. '/a/../..//evil.com' résout en pathname '//evil.com'
    // tout en restant sur REFERENCE_ORIGIN à cette étape). `out` repart ensuite
    // dans `new URL(target, request.url)` côté middleware.ts, qui la re-résout
    // et s'échapperait vers l'autre origine. On simule donc ce second passage
    // ici et on rejette si l'origine bouge à la ré-résolution.
    if (new URL(out, REFERENCE_ORIGIN).origin !== REFERENCE_ORIGIN) return '/projects'
    return out
  } catch {
    return '/projects'
  }
}

export function resolveAuthRedirect(url: string, hasSession: boolean): string | null {
  const [pathname, query = ''] = url.split('?')
  const params = new URLSearchParams(query)
  const isProtected = PROTECTED.some((r) => r.test(pathname))

  if (pathname === '/') return hasSession ? '/projects' : '/login'
  if (!hasSession && isProtected) return `/login?next=${encodeURIComponent(url)}`
  if (hasSession && pathname === '/login') return safeNext(params.get('next'))
  return null
}
