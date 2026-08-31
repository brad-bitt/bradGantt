import { resolveAuthRedirect, safeNext } from '@/lib/auth/redirect'

describe('safeNext', () => {
  it('retourne /projects par défaut', () => expect(safeNext(null)).toBe('/projects'))
  it('accepte un chemin relatif', () => expect(safeNext('/projects/abc')).toBe('/projects/abc'))
  it('refuse une URL absolue ou protocol-relative', () => {
    expect(safeNext('https://evil.com')).toBe('/projects')
    expect(safeNext('//evil.com')).toBe('/projects')
  })
  it('refuse le contournement par antislash, normalisé en slash par le parseur WHATWG', () => {
    // new URL('/\\evil.com', 'http://site') résout en 'http://evil.com/' : l'antislash
    // après un slash initial doit être traité comme une redirection ouverte.
    expect(safeNext('/\\evil.com')).toBe('/projects')
    expect(safeNext('\\\\evil.com')).toBe('/projects')
  })
  it('refuse le contournement par caractère de contrôle littéral (tabulation, CR, LF)', () => {
    // Le parseur WHATWG retire les tabulations/CR/LF avant résolution :
    // '/\t/evil.com' devient '//evil.com', donc une redirection protocol-relative.
    expect(safeNext('/\t/evil.com')).toBe('/projects')
    expect(safeNext('/\r/evil.com')).toBe('/projects')
    expect(safeNext('/\n/evil.com')).toBe('/projects')
  })
  it('accepte un chemin légitime contenant une tabulation encodée', () => {
    // '%09' n'est pas normalisé par le parseur (le '%' bloque la normalisation) :
    // ce n'est pas un vecteur d'attaque, doit rester un chemin relatif valide.
    expect(safeNext('/%09/evil.com')).toBe('/%09/evil.com')
  })
  it('refuse un schéma absolu non http/https', () => {
    expect(safeNext('javascript:alert(1)')).toBe('/projects')
    expect(safeNext('data:text/html,<script>alert(1)</script>')).toBe('/projects')
  })
  it('conserve la query string et le fragment sur un chemin relatif légitime', () => {
    expect(safeNext('/projects/42?zoom=week#section')).toBe('/projects/42?zoom=week#section')
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
