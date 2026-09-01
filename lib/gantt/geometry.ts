import { endOfISOWeek, endOfMonth, format, getISOWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Range, Rect, Zoom } from './types'
import { addDays, daysBetween, durationDays, formatDate, isWeekend, maxDate, minDate, parseDate } from './dates'

export const PX_PER_DAY: Record<Zoom, number> = { day: 40, week: 12, month: 4 }
export const ROW_HEIGHT = 44
export const HEADER_HEIGHT = 56
export const BAR_INSET = 8
export const SIDEBAR_WIDTH = 300
export const RESIZE_HANDLE_PX = 8

type Dated = { startDate: string; endDate: string }

export function computeRange(tasks: Dated[], today: string): Range {
  let start = addDays(today, -30)
  let end = addDays(today, 30)
  for (const t of tasks) {
    start = minDate(start, addDays(t.startDate, -7))
    end = maxDate(end, addDays(t.endDate, 30))
  }
  return { start, end }
}

export function timelineWidth(range: Range, zoom: Zoom): number {
  return durationDays(range.start, range.end) * PX_PER_DAY[zoom]
}

export function dateToX(iso: string, range: Range, zoom: Zoom): number {
  return daysBetween(range.start, iso) * PX_PER_DAY[zoom]
}

export function xToDate(x: number, range: Range, zoom: Zoom): string {
  return addDays(range.start, Math.floor(x / PX_PER_DAY[zoom]))
}

export function pxToDays(dx: number, zoom: Zoom): number {
  const ratio = dx / PX_PER_DAY[zoom]
  // Arrondi symétrique : arrondi vers zéro au-delà (away from zero at ±0.5)
  const rounded = Math.sign(ratio) * Math.floor(Math.abs(ratio) + 0.5)
  // Évite de retourner -0
  return rounded || 0
}

export function barRect(task: Dated, rowIndex: number, range: Range, zoom: Zoom): Rect {
  return {
    x: dateToX(task.startDate, range, zoom),
    y: rowIndex * ROW_HEIGHT + BAR_INSET,
    width: durationDays(task.startDate, task.endDate) * PX_PER_DAY[zoom],
    height: ROW_HEIGHT - 2 * BAR_INSET,
  }
}

export interface DayColumn { date: string; x: number; width: number; isWeekend: boolean; isToday: boolean }

export function dayColumns(range: Range, zoom: Zoom, today: string): DayColumn[] {
  const n = durationDays(range.start, range.end)
  const width = PX_PER_DAY[zoom]
  const cols: DayColumn[] = []
  for (let i = 0; i < n; i++) {
    const date = addDays(range.start, i)
    cols.push({ date, x: i * width, width, isWeekend: isWeekend(date), isToday: date === today })
  }
  return cols
}

export interface HeaderCell { key: string; label: string; x: number; width: number }

export function monthCells(range: Range, zoom: Zoom): HeaderCell[] {
  const cells: HeaderCell[] = []
  let cursor = range.start
  while (cursor <= range.end) {
    const end = minDate(formatDate(endOfMonth(parseDate(cursor))), range.end)
    cells.push({
      key: cursor,
      label: format(parseDate(cursor), 'MMMM yyyy', { locale: fr }),
      x: dateToX(cursor, range, zoom),
      width: durationDays(cursor, end) * PX_PER_DAY[zoom],
    })
    cursor = addDays(end, 1)
  }
  return cells
}

export function subCells(range: Range, zoom: Zoom): HeaderCell[] {
  if (zoom === 'day') {
    return dayColumns(range, zoom, '').map((c) => ({
      key: c.date,
      label: format(parseDate(c.date), 'EEEEE d', { locale: fr }),
      x: c.x,
      width: c.width,
    }))
  }
  const cells: HeaderCell[] = []
  let cursor = range.start
  while (cursor <= range.end) {
    const end = minDate(formatDate(endOfISOWeek(parseDate(cursor))), range.end)
    cells.push({
      key: cursor,
      label: `S${getISOWeek(parseDate(cursor))}`,
      x: dateToX(cursor, range, zoom),
      width: durationDays(cursor, end) * PX_PER_DAY[zoom],
    })
    cursor = addDays(end, 1)
  }
  return cells
}

/** Flèche fin → début en angles droits. Sort à droite de `from`, entre à gauche de `to`. */
export function arrowPath(from: Rect, to: Rect): string {
  const sx = from.x + from.width
  const sy = from.y + from.height / 2
  const ex = to.x
  const ey = to.y + to.height / 2
  const stub = 10
  if (ex - sx >= 2 * stub) return `M${sx},${sy} H${sx + stub} V${ey} H${ex}`
  // Contournement : le segment horizontal doit se situer strictement entre les deux barres
  // Si la cible est en dessous (to.y > from.y) : détour en bas
  // Si la cible est au-dessus (to.y < from.y) : détour au-delà de la cible
  const midY = to.y > from.y
    ? from.y + from.height + BAR_INSET  // cible en dessous
    : to.y + to.height + BAR_INSET      // cible au-dessus
  return `M${sx},${sy} H${sx + stub} V${midY} H${ex - stub} V${ey} H${ex}`
}

/**
 * Position horizontale de défilement à appliquer au chargement pour qu'« aujourd'hui » soit
 * visible sans être collé au bord : on laisse un quart de la largeur visible de contexte à sa
 * gauche (le passé récent). `viewportWidth` est la largeur du conteneur défilant, sidebar
 * collante comprise — c'est elle qui masque les `SIDEBAR_WIDTH` premiers pixels.
 *
 * Fonction pure et bornée à zéro : sur une plage courte (`todayX` proche de 0) ou un conteneur
 * plus étroit que la sidebar, elle ne renvoie jamais de valeur négative.
 */
export function initialScrollLeft(todayX: number, viewportWidth: number): number {
  const visible = Math.max(viewportWidth - SIDEBAR_WIDTH, 0)
  return Math.max(0, todayX - visible / 4)
}
