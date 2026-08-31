import { validateProjectName } from '@/lib/projects/validate'

describe('validateProjectName', () => {
  it('trim et accepte un nom valide', () => {
    expect(validateProjectName('  Refonte site  ')).toEqual({ ok: true, value: 'Refonte site' })
  })
  it('refuse un nom vide', () => {
    expect(validateProjectName('   ')).toEqual({ ok: false, error: 'Le nom est requis' })
  })
  it('refuse plus de 100 caractères', () => {
    expect(validateProjectName('x'.repeat(101))).toEqual({ ok: false, error: '100 caractères maximum' })
  })
})
