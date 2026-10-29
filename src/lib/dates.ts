import type { ISODate, MonthKey, Weekday } from '../types'

// All calendar maths happens in the browser's local time zone (Tashkent for the
// real centre). ISO date strings are always "YYYY-MM-DD" in local time.

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseISODate(value: ISODate): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isValidISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return toISODate(parseISODate(value)) === value
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function isoWeekday(date: Date): Weekday {
  const day = date.getDay()
  return (day === 0 ? 7 : day) as Weekday
}

export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return addDays(start, 1 - isoWeekday(start))
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function monthKey(date: Date): MonthKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export function monthKeyOf(isoDate: ISODate): MonthKey {
  return isoDate.slice(0, 7)
}

export function addMonths(key: MonthKey, months: number): MonthKey {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + months, 1))
}

/** Inclusive list of month keys from `from` to `to`. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const months: MonthKey[] = []
  for (let key = from; key <= to; key = addMonths(key, 1)) months.push(key)
  return months
}

export function daysInMonth(key: MonthKey): number {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** "14:30" -> 870 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** 870 -> "14:30" */
export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** Combine a local calendar day and "HH:mm" into a Date. */
export function atTime(isoDate: ISODate, time: string): Date {
  const date = parseISODate(isoDate)
  const minutes = timeToMinutes(time)
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return date
}
