import {
  PX_PER_DAY, ROW_HEIGHT, BAR_INSET, computeRange, dateToX, xToDate, pxToDays, barRect,
  timelineWidth, dayColumns, monthCells, subCells, arrowPath,
} from '@/lib/gantt/geometry'

const today = '2026-08-31'

describe('computeRange', () => {
  it('sans tâche : aujourd\'hui ± 30 jours', () => {
    expect(computeRange([], today)).toEqual({ start: '2026-08-01', end: '2026-09-30' })
  })
  it('élargit à min − 7 et max + 30', () => {
    const r = computeRange([{ startDate: '2026-06-15', endDate: '2026-12-01' }], today)
    expect(r).toEqual({ start: '2026-06-08', end: '2026-12-31' })
  })
})

describe('conversions', () => {
  const range = { start: '2026-08-01', end: '2026-09-30' }
  it('dateToX', () => {
    expect(dateToX('2026-08-01', range, 'day')).toBe(0)
    expect(dateToX('2026-08-11', range, 'day')).toBe(10 * PX_PER_DAY.day)
    expect(dateToX('2026-08-11', range, 'month')).toBe(10 * PX_PER_DAY.month)
  })
  it('xToDate arrondit au jour inférieur', () => {
    expect(xToDate(39, range, 'day')).toBe('2026-08-01')
    expect(xToDate(40, range, 'day')).toBe('2026-08-02')
  })
  it('pxToDays arrondit au plus proche', () => {
    expect(pxToDays(59, 'day')).toBe(1)
    expect(pxToDays(61, 'day')).toBe(2)
    expect(pxToDays(-25, 'day')).toBe(-1)
  })
  it('timelineWidth est inclusive', () => {
    expect(timelineWidth({ start: '2026-09-01', end: '2026-09-03' }, 'day')).toBe(3 * 40)
  })
  it('barRect', () => {
    const rect = barRect({ startDate: '2026-08-03', endDate: '2026-08-05' }, 2, range, 'day')
    expect(rect).toEqual({ x: 80, y: 2 * ROW_HEIGHT + BAR_INSET, width: 120, height: ROW_HEIGHT - 2 * BAR_INSET })
  })
})

describe('en-têtes', () => {
  const range = { start: '2026-08-25', end: '2026-09-05' }
  it('dayColumns marque weekends et aujourd\'hui', () => {
    const cols = dayColumns(range, 'day', today)
    expect(cols).toHaveLength(12)
    expect(cols.find((c) => c.date === '2026-08-29')?.isWeekend).toBe(true)
    expect(cols.find((c) => c.date === today)?.isToday).toBe(true)
  })
  it('monthCells découpe par mois avec libellé français', () => {
    const cells = monthCells(range, 'day')
    expect(cells.map((c) => c.label)).toEqual(['août 2026', 'septembre 2026'])
    expect(cells[0].width).toBe(7 * 40)
    expect(cells[1].x).toBe(7 * 40)
  })
  it('subCells : jours en zoom jour, semaines ISO sinon', () => {
    expect(subCells(range, 'day')).toHaveLength(12)
    const weeks = subCells(range, 'week')
    expect(weeks.map((w) => w.label)).toEqual(['S35', 'S36'])
  })
})

describe('arrowPath', () => {
  it('trace en angles droits vers une cible à droite', () => {
    const from = { x: 0, y: 8, width: 80, height: 28 }
    const to = { x: 160, y: 52, width: 40, height: 28 }
    expect(arrowPath(from, to)).toBe('M80,22 H90 V66 H160')
  })
  it('contourne quand la cible commence avant la fin de la source', () => {
    const from = { x: 0, y: 8, width: 200, height: 28 }
    const to = { x: 100, y: 52, width: 40, height: 28 }
    expect(arrowPath(from, to)).toBe('M200,22 H210 V44 H90 V66 H100')
  })
})
