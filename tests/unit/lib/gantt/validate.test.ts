import { validateTaskInput } from '@/lib/gantt/validate'

const base = { title: 'X', type: 'task' as const, startDate: '2026-09-01', endDate: '2026-09-03', progress: 0 }

describe('validateTaskInput', () => {
  it('accepte une entrée valide', () => expect(validateTaskInput(base)).toEqual({ ok: true }))

  it('accepte une tâche d\'un seul jour (fin = début)', () => {
    expect(validateTaskInput({ ...base, endDate: base.startDate })).toEqual({ ok: true })
  })

  it('refuse un titre vide', () => {
    expect(validateTaskInput({ ...base, title: '  ' })).toEqual({ ok: false, errors: { title: 'Le titre est requis' } })
  })

  it('refuse une fin avant le début', () => {
    expect(validateTaskInput({ ...base, endDate: '2026-08-31' })).toEqual({ ok: false, errors: { dates: 'La fin doit être après le début' } })
  })

  it('refuse une date invalide', () => {
    expect(validateTaskInput({ ...base, startDate: '' })).toEqual({ ok: false, errors: { dates: 'Dates invalides' } })
  })

  it('refuse une fin non renseignée sur une tâche', () => {
    expect(validateTaskInput({ ...base, endDate: '' })).toEqual({ ok: false, errors: { dates: 'Dates invalides' } })
  })

  it('cumule les deux erreurs', () => {
    expect(validateTaskInput({ ...base, title: '', endDate: '2026-08-31' })).toEqual({
      ok: false,
      errors: { title: 'Le titre est requis', dates: 'La fin doit être après le début' },
    })
  })

  it('ignore la fin pour un jalon', () => {
    expect(validateTaskInput({ ...base, type: 'milestone', endDate: '2000-01-01' })).toEqual({ ok: true })
  })

  // Un groupe n'expose pas ses dates dans l'éditeur (ses bornes affichées viennent de ses
  // enfants), mais le formulaire les transmet telles quelles : elles doivent rester validées
  // comme celles d'une tâche, sinon un groupe sans enfant pourrait partir avec fin < début et
  // se faire rejeter par la contrainte `tasks_dates_order` — un toast au lieu d'un message clair.
  it('valide les dates d\'un groupe comme celles d\'une tâche', () => {
    expect(validateTaskInput({ ...base, type: 'group', endDate: '2000-01-01' })).toEqual({
      ok: false,
      errors: { dates: 'La fin doit être après le début' },
    })
  })

  it('valide quand même le début d\'un jalon', () => {
    expect(validateTaskInput({ ...base, type: 'milestone', startDate: 'hier' })).toEqual({ ok: false, errors: { dates: 'Dates invalides' } })
  })
})
