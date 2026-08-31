const PROTECTED = [/^\/projects(\/|$)/, /^\/invite(\/|$)/]

export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/projects'
  return next
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
