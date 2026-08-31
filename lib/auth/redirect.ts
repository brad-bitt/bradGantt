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
    return resolved.pathname + resolved.search + resolved.hash
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
