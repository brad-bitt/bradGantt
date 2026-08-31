import { addDays, daysBetween, durationDays, isWeekend, minDate, maxDate } from '@/lib/gantt/dates'

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
})
