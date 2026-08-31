import { NextRequest, NextResponse } from 'next/server'

// Teste middleware() lui-même (composition updateSession + resolveAuthRedirect +
// copyCookies), pas seulement copyCookies isolément : un test unitaire de copyCookies
// seul ne détecterait pas une régression où middleware.ts oublierait de l'appeler (ex.
// un retour direct à `return NextResponse.redirect(...)`, qui réintroduirait
// exactement le bug B1) — toute la suite resterait verte dans ce cas.
const mockUpdateSession = vi.fn()
vi.mock('@/lib/supabase/middleware', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase/middleware')>('@/lib/supabase/middleware')
  return { ...actual, updateSession: (...args: unknown[]) => mockUpdateSession(...args) }
})

import { middleware } from '@/middleware'

function sessionResponseWithRefreshedCookie() {
  const response = NextResponse.next()
  response.cookies.set('sb-access-token', 'refreshed', { path: '/' })
  return response
}

describe('middleware() : les trois chemins de redirection conservent le cookie rafraîchi par updateSession', () => {
  beforeEach(() => mockUpdateSession.mockReset())

  it('/ avec session : redirige vers /projects et conserve le cookie', async () => {
    mockUpdateSession.mockResolvedValue({ response: sessionResponseWithRefreshedCookie(), user: { id: 'u1' } })
    const res = await middleware(new NextRequest('http://localhost:3100/'))
    expect(res.headers.get('location')).toBe('http://localhost:3100/projects')
    expect(res.cookies.get('sb-access-token')?.value).toBe('refreshed')
  })

  it('/login avec session : redirige vers /projects et conserve le cookie', async () => {
    mockUpdateSession.mockResolvedValue({ response: sessionResponseWithRefreshedCookie(), user: { id: 'u1' } })
    const res = await middleware(new NextRequest('http://localhost:3100/login'))
    expect(res.headers.get('location')).toBe('http://localhost:3100/projects')
    expect(res.cookies.get('sb-access-token')?.value).toBe('refreshed')
  })

  it('route protégée sans session : redirige vers /login?next=... et conserve le cookie', async () => {
    mockUpdateSession.mockResolvedValue({ response: sessionResponseWithRefreshedCookie(), user: null })
    const res = await middleware(new NextRequest('http://localhost:3100/projects'))
    expect(res.headers.get('location')).toBe('http://localhost:3100/login?next=%2Fprojects')
    expect(res.cookies.get('sb-access-token')?.value).toBe('refreshed')
  })
})
