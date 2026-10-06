import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH, validateTicketInput } from '@/lib/tickets/validate'

describe('validateTicketInput', () => {
  it('accepte un titre simple sans description', () => {
    expect(validateTicketInput({ title: 'Corriger la frise', description: '' })).toEqual({ ok: true })
  })

  it('refuse un titre vide ou fait d\'espaces', () => {
    expect(validateTicketInput({ title: '', description: '' })).toEqual({ ok: false, errors: { title: 'Le titre est requis' } })
    expect(validateTicketInput({ title: '   ', description: '' })).toEqual({ ok: false, errors: { title: 'Le titre est requis' } })
  })

  it('refuse un titre plus long que la contrainte en base', () => {
    const v = validateTicketInput({ title: 'x'.repeat(TITLE_MAX_LENGTH + 1), description: '' })
    expect(v).toEqual({ ok: false, errors: { title: `Le titre ne peut pas dépasser ${TITLE_MAX_LENGTH} caractères` } })
  })

  it('mesure le titre APRÈS trim, comme la contrainte SQL', () => {
    expect(validateTicketInput({ title: `  ${'x'.repeat(TITLE_MAX_LENGTH)}  `, description: '' })).toEqual({ ok: true })
  })

  it('refuse une description plus longue que la contrainte en base', () => {
    const v = validateTicketInput({ title: 'Titre', description: 'x'.repeat(DESCRIPTION_MAX_LENGTH + 1) })
    expect(v).toEqual({ ok: false, errors: { description: `La description ne peut pas dépasser ${DESCRIPTION_MAX_LENGTH} caractères` } })
  })

  it('signale les deux erreurs à la fois', () => {
    const v = validateTicketInput({ title: '', description: 'x'.repeat(DESCRIPTION_MAX_LENGTH + 1) })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(Object.keys(v.errors).sort()).toEqual(['description', 'title'])
  })
})
