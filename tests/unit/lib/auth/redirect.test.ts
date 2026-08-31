import { resolveAuthRedirect, safeNext } from '@/lib/auth/redirect'

describe('safeNext', () => {
  it('retourne /projects par défaut', () => expect(safeNext(null)).toBe('/projects'))
  it('accepte un chemin relatif', () => expect(safeNext('/projects/abc')).toBe('/projects/abc'))
  it('refuse une URL absolue ou protocol-relative', () => {
    expect(safeNext('https://evil.com')).toBe('/projects')
    expect(safeNext('//evil.com')).toBe('/projects')
  })
})

describe('resolveAuthRedirect', () => {
  it('redirige un anonyme vers /login avec next sur une route protégée', () => {
    expect(resolveAuthRedirect('/projects/42?zoom=week', false)).toBe('/login?next=%2Fprojects%2F42%3Fzoom%3Dweek')
    expect(resolveAuthRedirect('/invite/tok', false)).toBe('/login?next=%2Finvite%2Ftok')
  })
  it('laisse un anonyme sur /login', () => expect(resolveAuthRedirect('/login', false)).toBeNull())
  it('renvoie un connecté de /login vers next ou /projects', () => {
    expect(resolveAuthRedirect('/login', true)).toBe('/projects')
    expect(resolveAuthRedirect('/login?next=%2Finvite%2Ftok', true)).toBe('/invite/tok')
  })
  it('redirige la racine', () => {
    expect(resolveAuthRedirect('/', false)).toBe('/login')
    expect(resolveAuthRedirect('/', true)).toBe('/projects')
  })
  it('ne touche pas aux routes publiques', () => {
    expect(resolveAuthRedirect('/auth/callback?code=x', false)).toBeNull()
    expect(resolveAuthRedirect('/projects', true)).toBeNull()
  })
})
