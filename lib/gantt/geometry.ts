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
/**
 * Distance à parcourir avant qu'une pression ne devienne un glissement. Sous ce seuil le geste
 * n'est pas armé et son delta reste gelé à zéro.
 *
 * Sans lui, le premier pixel parcouru comptait : une demi-colonne suffisant à décaler d'un jour,
 * il fallait 20 px au zoom jour, 6 px en semaine et **2 px au zoom mois** pour modifier la tâche.
 * Un double-clic humain tremble de 1 à 3 px : au zoom mois, ouvrir l'éditeur enregistrait donc
 * aussi un déplacement d'un jour, dans une application sans annulation.
 */
export const DRAG_THRESHOLD_PX = 4
/**
 * Épaisseur de la bordure d'une barre — doit rester égale au `border-[3px]` de `TaskBar`.
 *
 * Elle compte : les barres sont en `box-sizing: border-box` (préflight Tailwind), donc un enfant
 * `absolute` posé à `left: 0` commence APRÈS la bordure. Une poignée bornée au quart d'une barre
 * de 12 px se retrouvait ainsi au MILIEU du dessin, les deux poignées occupant à elles seules les
 * 6 px de la boîte de contenu et ne laissant « déplaçables » que les deux liserés de bordure. Les
 * poignées débordent donc de la bordure (`-BAR_BORDER_PX`) pour couvrir les bords VISIBLES de la
 * barre, et le milieu reste ce qu'il doit être : la zone de déplacement.
 */
export const BAR_BORDER_PX = 3

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

/**
 * Étend la FIN d'une plage pour que la timeline couvre au moins `minWidth` pixels.
 *
 * `computeRange` raisonne en JOURS (aujourd'hui ±30 au minimum), jamais en pixels : la même
 * plage de 61 jours donne 2 440 px au zoom jour mais 732 px en semaine et 244 px en mois. Sur
 * une zone de timeline d'environ 1 000 px, les deux zooms les plus larges laissaient donc un
 * grand vide crème à droite — d'autant plus grand que le zoom était large.
 *
 * SEULE LA FIN BOUGE. `dateToX` mesure depuis `range.start` : reculer le début décalerait
 * toutes les abscisses déjà calculées, donc le recentrage initial sur aujourd'hui et la
 * géométrie du glisser-déposer. Étendre par la fin est invisible pour tout ce qui existe.
 *
 * Ne raccourcit jamais : une plage déjà plus large que l'écran est rendue telle quelle.
 */
export function extendRangeToWidth(range: Range, zoom: Zoom, minWidth: number): Range {
  if (!(minWidth > 0)) return range
  const needed = Math.ceil(minWidth / PX_PER_DAY[zoom])
  if (needed <= durationDays(range.start, range.end)) return range
  return { start: range.start, end: addDays(range.start, needed - 1) }
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

/**
 * Largeur d'une poignée de redimensionnement pour une barre de `barWidth` pixels : jamais plus
 * du quart de la barre.
 *
 * `RESIZE_HANDLE_PX` en dur laissait les deux poignées (8 px chacune) recouvrir toute barre plus
 * étroite que 16 px. Au zoom mois (4 px/jour) une tâche de 3 jours fait 12 px : la zone de
 * déplacement disparaissait — mesuré à 0 px sur 12, la poignée droite, dernière dans le DOM à
 * `z-index` égal, l'emportant sur 9 px. Toute tâche de 4 jours ou moins n'était plus que
 * redimensionnable.
 *
 * Le quart borne les deux poignées à la moitié de la barre : il reste toujours au moins la moitié
 * pour la saisir et la déplacer, à tous les zooms.
 */
export function resizeHandleWidth(barWidth: number): number {
  return Math.min(RESIZE_HANDLE_PX, Math.max(barWidth, 0) / 4)
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
