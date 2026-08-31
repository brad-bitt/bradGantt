import { addDays as dfAddDays, differenceInCalendarDays, format, isWeekend as dfIsWeekend, parseISO } from 'date-fns'

export const ISO = 'yyyy-MM-dd'

// Memoïse le temps (en millisecondes) d'une chaîne ISO pour éviter de réanalyser à chaque appel.
// Pendant une opération de glissement, les mêmes dates sont appelées plusieurs fois par image,
// donc le taux de succès du cache est élevé. Limité pour prévenir les fuites mémoire sur sessions longues.
// Note : on stocke le temps en millisecondes plutôt que l'objet Date pour éviter les mutations.
// Si on retournait la même instance, un appelant pourrait faire `d.setDate()` et corrompre
// le cache de façon permanente (y compris sur d'autres fichiers). Reconstituer une Date
// depuis des millisecondes coûte ~100 ns, vs ~4 µs pour analyser une chaîne ISO : l'optimisation
// sur le parsing reste dominante.
const PARSE_CACHE_LIMIT = 5000
const parseCache = new Map<string, number>()

export function parseDate(iso: string): Date {
  let cachedTime = parseCache.get(iso)
  if (cachedTime === undefined) {
    const parsed = parseISO(iso)
    cachedTime = parsed.getTime()
    if (parseCache.size >= PARSE_CACHE_LIMIT) {
      // Purge des entrées les plus anciennes (simple FIFO, pas LRU)
      let deleteCount = Math.floor(PARSE_CACHE_LIMIT * 0.2) // Enlève 20% quand la limite est atteinte
      for (const key of parseCache.keys()) {
        if (deleteCount <= 0) break
        parseCache.delete(key)
        deleteCount--
      }
    }
    parseCache.set(iso, cachedTime)
  }
  // Retourner une copie plutôt que l'instance mise en cache : cela évite que un appelant
  // qui mute la date (même si c'est rare) ne corrompe le cache de façon permanente
  return new Date(cachedTime)
}
export function formatDate(d: Date): string { return format(d, ISO) }
export function todayISO(): string { return formatDate(new Date()) }
export function addDays(iso: string, n: number): string { return formatDate(dfAddDays(parseDate(iso), n)) }
export function daysBetween(a: string, b: string): number { return differenceInCalendarDays(parseDate(b), parseDate(a)) }
export function durationDays(start: string, end: string): number { return daysBetween(start, end) + 1 }
export function isWeekend(iso: string): boolean { return dfIsWeekend(parseDate(iso)) }
export function minDate(a: string, b: string): string { return a < b ? a : b }
export function maxDate(a: string, b: string): string { return a > b ? a : b }
