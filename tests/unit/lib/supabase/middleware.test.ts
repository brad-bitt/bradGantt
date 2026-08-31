import { NextResponse } from 'next/server'
import { copyCookies } from '@/lib/supabase/middleware'

describe('copyCookies', () => {
  it('recopie les cookies de la réponse source sur la réponse cible', () => {
    const source = NextResponse.next()
    source.cookies.set('sb-access-token', 'refreshed-token', { path: '/' })
    source.cookies.set('sb-refresh-token', 'refreshed-refresh', { path: '/' })

    const target = NextResponse.redirect('https://app.test/login')
    const result = copyCookies(source, target)

    expect(result.cookies.get('sb-access-token')?.value).toBe('refreshed-token')
    expect(result.cookies.get('sb-refresh-token')?.value).toBe('refreshed-refresh')
  })

  it('n\'écrase pas les cookies déjà présents sur la cible si la source n\'en porte pas', () => {
    const source = NextResponse.next()
    const target = NextResponse.redirect('https://app.test/login')
    target.cookies.set('other', 'value')

    const result = copyCookies(source, target)

    expect(result.cookies.get('other')?.value).toBe('value')
  })

  it('reproduit le scénario du middleware : la réponse de redirection porte le cookie rafraîchi par updateSession', () => {
    // updateSession() reconstruit `response` en cas de rotation du refresh token.
    // Une redirection construite indépendamment doit hériter de ces cookies plutôt
    // que de les jeter — c'est le bug corrigé sur / , /login (avec session) et
    // /projects (sans session).
    const refreshedSessionResponse = NextResponse.next()
    refreshedSessionResponse.cookies.set('sb-access-token', 'rotated', { path: '/' })

    const redirect = NextResponse.redirect('https://app.test/projects')
    const final = copyCookies(refreshedSessionResponse, redirect)

    expect(final.headers.get('location')).toBe('https://app.test/projects')
    expect(final.cookies.get('sb-access-token')?.value).toBe('rotated')
  })
})
