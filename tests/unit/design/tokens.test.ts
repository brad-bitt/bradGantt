import { readFileSync } from 'node:fs'

// Garde-fou de la spec §3 : les jetons de l'identité éditoriale existent, ceux du brutalisme
// n'existent plus. Lu dans le fichier source : Vitest ne compile pas le CSS de Tailwind.
const css = readFileSync('app/globals.css', 'utf8')

describe('jetons de design', () => {
  it('pose les cinq jetons de structure, clair et sombre', () => {
    for (const token of ['--color-paper', '--color-surface', '--color-ink', '--color-ink-soft', '--color-line']) {
      expect(css.match(new RegExp(`${token}:`, 'g'))?.length, token).toBe(2)
    }
  })

  it('pose l’or « actif », sa version voilée, les deux rouges', () => {
    expect(css).toMatch(/--color-accent: #F2C319;/)
    expect(css).toMatch(/--color-accent-soft: color-mix\(in srgb, #F2C319 28%, transparent\);/)
    expect(css).toMatch(/--color-today: #E5342A;/)
    expect(css).toMatch(/--color-danger: #C8321F;/)
  })

  it('garde les huit couleurs de tâches', () => {
    for (const name of ['tangerine', 'rose', 'blue', 'emerald', 'violet', 'cyan', 'lime', 'ochre']) {
      expect(css).toMatch(new RegExp(`--color-${name}: #[0-9A-F]{6};`))
    }
  })

  it('remplace l’échelle Tailwind : rien sous 13 px', () => {
    expect(css).toMatch(/--text-xs: 13px;/)
    expect(css).toMatch(/--text-sm: 14px;/)
    expect(css).toMatch(/--text-base: 15px;/)
  })

  it('pose les rayons, les deux ombres et la teinte des barres', () => {
    for (const token of ['--radius-dialog: 12px', '--radius-card: 10px', '--radius-control: 7px', '--radius-bar: 6px', '--shadow-float:', '--shadow-dialog:', '--data-tint: 32%']) {
      expect(css, token).toContain(token)
    }
  })

  it('la teinte des barres ne monte pas la nuit : plus de couleur éclaircit le fond sous une encre claire (revue I3)', () => {
    expect(css).not.toContain('--data-tint: 45%')
  })

  it('l’anneau de focus a un trait d’encre (3:1 sur papier), l’or en halo (revue I2)', () => {
    const ring = css.slice(css.indexOf('.focus-ring '), css.indexOf('\n', css.indexOf('.focus-ring ')))
    expect(ring).toContain('focus-visible:outline-ink')
    expect(ring).toContain('accent')
  })

  it('définit les utilitaires de l’identité et la variante sombre', () => {
    for (const util of ['.focus-ring', '.hatch', '.day-tick', '.data-bar', '.data-bar-late', '.data-bar-progress']) {
      expect(css, util).toContain(`${util} `)
    }
    expect(css).toContain('@custom-variant dark')
  })

  it('ne contient plus rien du brutalisme', () => {
    for (const old of ['--color-cream', '--color-band', '--color-header', '--color-on-header', '--color-on-data', '--color-yellow', 'shadow-brutal', '.brutal', 'hatch-data', 'radial-gradient', 'border-radius: 0', 'uppercase']) {
      expect(css, old).not.toContain(old)
    }
  })
})
