import { addDays, daysBetween, durationDays, isWeekend, minDate, maxDate, parseDate, formatDate, todayISO } from '@/lib/gantt/dates'

describe('dates', () => {
  it('addDays gère les fins de mois', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02')
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
  })
  it('daysBetween est signé', () => {
    expect(daysBetween('2026-09-01', '2026-09-04')).toBe(3)
    expect(daysBetween('2026-09-04', '2026-09-01')).toBe(-3)
  })
  it('durationDays est inclusive', () => {
    expect(durationDays('2026-09-01', '2026-09-01')).toBe(1)
    expect(durationDays('2026-09-01', '2026-09-03')).toBe(3)
  })
  it('isWeekend', () => {
    expect(isWeekend('2026-09-05')).toBe(true) // samedi
    expect(isWeekend('2026-09-07')).toBe(false) // lundi
  })
  it('min/max', () => {
    expect(minDate('2026-09-01', '2026-08-31')).toBe('2026-08-31')
    expect(maxDate('2026-09-01', '2026-08-31')).toBe('2026-09-01')
  })

  // Tests de couverture robustes
  it('ancrage local des dates - parseDate/formatDate roundtrip', () => {
    // Vérifier que les dates sont ancrées correctement localement (pas de décalage fuseau)
    const dates = ['2026-01-01', '2026-12-31', '2026-09-15', '2027-02-28', '2028-02-29']
    dates.forEach((iso) => {
      const parsed = parseDate(iso)
      expect(parsed.getFullYear()).toBe(parseInt(iso.slice(0, 4)))
      expect(parsed.getMonth()).toBe(parseInt(iso.slice(5, 7)) - 1)
      expect(parsed.getDate()).toBe(parseInt(iso.slice(8, 10)))
      expect(formatDate(parsed)).toBe(iso)
    })
  })

  it('année bissextile - 29 février', () => {
    // 2028 est une année bissextile
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    // 2027 n'est pas une année bissextile
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
    // daysBetween autour du 29 février
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
  })

  it('passage d\'année', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(daysBetween('2026-12-31', '2027-01-02')).toBe(2)
  })

  it('isWeekend - samedi, dimanche, vendredi', () => {
    expect(isWeekend('2026-09-05')).toBe(true) // samedi
    expect(isWeekend('2026-09-06')).toBe(true) // dimanche
    expect(isWeekend('2026-09-04')).toBe(false) // vendredi
  })

  it('durationDays et daysBetween sur longue période', () => {
    // Une année entière de 2026
    const duration = durationDays('2026-01-01', '2026-12-31')
    expect(duration).toBe(365)
    const diff = daysBetween('2026-01-01', '2026-12-31')
    expect(diff).toBe(364)
    // Une année bissextile
    const bisextileDuration = durationDays('2028-01-01', '2028-12-31')
    expect(bisextileDuration).toBe(366)
  })

  it('todayISO retourne un format valide et cohérent', () => {
    const today = todayISO()
    // Vérifier le format yyyy-MM-dd avec une regex
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Vérifier la cohérence avec formatDate(new Date())
    expect(today).toBe(formatDate(new Date()))
  })
})
