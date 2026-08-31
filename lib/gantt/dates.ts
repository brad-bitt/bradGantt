import { addDays as dfAddDays, differenceInCalendarDays, format, isWeekend as dfIsWeekend, parseISO } from 'date-fns'

export const ISO = 'yyyy-MM-dd'

// Memoize parseISO to avoid reparsing the same ISO strings on every call.
// During a drag operation, many calls are made with the same set of dates per frame,
// so cache hit rate is high. Bounded to prevent memory leaks on long sessions.
const PARSE_CACHE_LIMIT = 5000
const parseCache = new Map<string, Date>()

export function parseDate(iso: string): Date {
  let cached = parseCache.get(iso)
  if (!cached) {
    cached = parseISO(iso)
    if (parseCache.size >= PARSE_CACHE_LIMIT) {
      // Purge oldest entries (simple FIFO, not LRU)
      let deleteCount = Math.floor(PARSE_CACHE_LIMIT * 0.2) // Remove 20% when limit reached
      for (const key of parseCache.keys()) {
        if (deleteCount <= 0) break
        parseCache.delete(key)
        deleteCount--
      }
    }
    parseCache.set(iso, cached)
  }
  return cached
}
export function formatDate(d: Date): string { return format(d, ISO) }
export function todayISO(): string { return formatDate(new Date()) }
export function addDays(iso: string, n: number): string { return formatDate(dfAddDays(parseDate(iso), n)) }
export function daysBetween(a: string, b: string): number { return differenceInCalendarDays(parseDate(b), parseDate(a)) }
export function durationDays(start: string, end: string): number { return daysBetween(start, end) + 1 }
export function isWeekend(iso: string): boolean { return dfIsWeekend(parseDate(iso)) }
export function minDate(a: string, b: string): string { return a < b ? a : b }
export function maxDate(a: string, b: string): string { return a > b ? a : b }
