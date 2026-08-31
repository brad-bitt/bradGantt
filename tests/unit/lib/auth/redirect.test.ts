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
  it('refuse le contournement par segments .. qui font réapparaître un préfixe protocol-relative', () => {
    // La résolution des segments '..'/'.' dans le pathname peut faire apparaître
    // '//host' sans que l'origine de la PREMIÈRE résolution n'ait bougé : c'est la
    // valeur de SORTIE qu'il faut re-valider, pas seulement l'entrée.
    expect(safeNext('/a/../..//evil.com/phish')).toBe('/projects')
    expect(safeNext('/..//evil.com')).toBe('/projects')
    expect(safeNext('/../..//evil.com')).toBe('/projects')
    expect(safeNext('/..///evil.com')).toBe('/projects')
    expect(safeNext('/.\\/evil.com')).toBe('/projects')
    expect(safeNext('/./\\/evil.com')).toBe('/projects')
    expect(safeNext('/..//evil.com/p?a=1#f')).toBe('/projects')
    expect(safeNext('/..//evil.com@x')).toBe('/projects')
  })
  it("ne laisse jamais fuir l'hôte de l'origine de référence interne dans la sortie", () => {
    // L'origine de référence utilisée pour valider next ('bradgantt.internal') est
    // un hôte arbitraire jamais exposé publiquement — mais si next la désigne
    // explicitement, les DEUX résolutions restent sur cette même origine (elle est
    // par définition son propre point fixe), donc la validation par origine seule
    // ne suffit pas à l'écarter. C'est le seul cas où la fonction n'était pas un
    // point fixe : safeNext('//bradgantt.internal/x') renvoyait '/x' alors que
    // safeNext('/..//bradgantt.internal/pwn') renvoyait encore '//bradgantt.internal/pwn'
    // (préfixe protocol-relative conservé tel quel dans la sortie intermédiaire).
    // La sortie doit systématiquement être re-normalisée avant d'être renvoyée :
    // aucun résultat ne doit commencer par '//' (protocol-relative), et rejouer le
    // second passage du middleware (new URL(out, origine réelle de l'appli)) ne
    // doit jamais atterrir sur une origine différente de celle de l'appli.
    for (const input of [
      '/..//bradgantt.internal/pwn',
      '/..//BRADGANTT.internal/pwn',
      '/..//user:pw@bradgantt.internal/pwn',
    ]) {
      const out = safeNext(input)
      expect(out.startsWith('//')).toBe(false)
      expect(new URL(out, 'https://app.test').origin).toBe('https://app.test')
    }
  })

  // --- Test de propriété générique sur corpus généré ---
  //
  // C'est le test qui aurait attrapé les trois régressions successives (antislash/
  // contrôle, segments '..', fuite de l'hôte de référence) : au lieu d'une liste
  // figée d'exemples connus, on combine un jeu de « jetons dangereux » pour
  // produire quelques centaines d'entrées, et on vérifie pour chacune deux
  // invariants qui doivent tenir INCONDITIONNELLEMENT, quel que soit le vecteur :
  //   1. safeNext est un point fixe : safeNext(safeNext(x)) === safeNext(x)
  //   2. aucune sortie ne fuit hors de l'origine réelle de l'application, une fois
  //      rejouée exactement comme le fait middleware.ts (new URL(out, origine)).
  function generateCorpus(): string[] {
    const broadTokens = [
      '/', '\\', '.', '..', '%2e', '//', '@', ':', '#', '?', '%09', '\t', '\r',
      'evil.com', 'bradgantt.internal',
    ]
    const deepFamilyTokens = ['/', '\\', '.', '..', '%2e', 'bradgantt.internal', '@', '//']

    const seen = new Set<string>()
    const combine = (tokens: string[], depth: number) => {
      const build = (prefix: string, remaining: number) => {
        seen.add(prefix)
        if (remaining === 0) return
        for (const t of tokens) build(prefix + t, remaining - 1)
      }
      for (const t of tokens) build(t, depth - 1)
    }
    combine(broadTokens, 2) // toutes les paires du jeu large
    combine(deepFamilyTokens, 3) // triplets sur le sous-ensemble le plus sensible (famille '..' / hôte de référence)
    return Array.from(seen)
  }

  const corpus = generateCorpus()

  it(`vérifie point-fixe et absence de fuite d'origine sur un corpus généré de ${corpus.length} entrées`, () => {
    for (const input of corpus) {
      const once = safeNext(input)
      expect(safeNext(once)).toBe(once)
      expect(new URL(once, 'https://app.test').origin).toBe('https://app.test')
    }
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
