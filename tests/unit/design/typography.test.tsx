import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

// Garde-fou de la spec §3 : aucune capitale forcée, rien sous 13 px, plus aucun utilitaire ni
// jeton du brutalisme. Lu dans les sources de `app/` et `components/` (TSX, TS, CSS).
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(p)) out.push(p)
  }
  return out
}
const files = [...walk('app'), ...walk('components')]
const offenders = (re: RegExp) => files.filter((f) => re.test(readFileSync(f, 'utf8')))

describe('typographie et identité (spec §3)', () => {
  it('aucune capitale forcée', () => {
    expect(offenders(/\buppercase\b/)).toEqual([])
  })
  it('aucune taille arbitraire sous 13 px', () => {
    expect(offenders(/text-\[(?:[0-9]|1[0-2])px\]/)).toEqual([])
  })
  it('plus aucun utilitaire ni jeton brutaliste', () => {
    expect(offenders(/shadow-brutal|brutal-focus|brutal-press|\bbrutal\b|hatch-data|on-data|bg-cream|text-cream|stroke-cream|bg-header|on-header|bg-band|border-\[3px\]|border-[trbl]-\[3px\]|bg-yellow|text-yellow|border-yellow|outline-dashed/)).toEqual([])
  })
  it('les libellés de champ sont en casse mixte', () => {
    render(
      <>
        <Input label="Titre" />
        <Select label="Statut" options={[{ value: 'a', label: 'A' }]} />
        <Textarea label="Description" />
      </>,
    )
    for (const name of ['Titre', 'Statut', 'Description']) {
      expect(screen.getByText(name)).not.toHaveClass('uppercase')
    }
  })
})
