import { addDays as dfAddDays, differenceInCalendarDays, format, isWeekend as dfIsWeekend, parseISO } from 'date-fns'

export const ISO = 'yyyy-MM-dd'

export function parseDate(iso: string): Date { return parseISO(iso) }
export function formatDate(d: Date): string { return format(d, ISO) }
export function todayISO(): string { return formatDate(new Date()) }
export function addDays(iso: string, n: number): string { return formatDate(dfAddDays(parseDate(iso), n)) }
export function daysBetween(a: string, b: string): number { return differenceInCalendarDays(parseDate(b), parseDate(a)) }
export function durationDays(start: string, end: string): number { return daysBetween(start, end) + 1 }
export function isWeekend(iso: string): boolean { return dfIsWeekend(parseDate(iso)) }
export function minDate(a: string, b: string): string { return a < b ? a : b }
export function maxDate(a: string, b: string): string { return a > b ? a : b }
