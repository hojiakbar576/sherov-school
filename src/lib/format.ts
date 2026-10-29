import type {
  AttendanceMark,
  DayPattern,
  GroupStatus,
  ISODate,
  ISODateTime,
  MonthKey,
  PaymentMethod,
  PaymentStatus,
  StudentStatus,
  TeacherStatus,
} from '../types'
import { parseISODate, startOfDay } from './dates'

const LOCALE = 'en-GB'

// Fixed English month abbreviations ("Sep", not the en-GB "Sept").
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** UZS 1,250,000 */
export function formatUZS(amount: number): string {
  return `UZS ${wholeNumber.format(Math.round(amount))}`
}

/** UZS 86.4M, UZS 650K: for headline figures where precision is not needed. */
export function formatUZSCompact(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000_000) return `UZS ${(amount / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `UZS ${(amount / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `UZS ${Math.round(amount / 1_000)}K`
  return formatUZS(amount)
}

/** Short axis labels: 86.4M, 650K */
export function formatAxisAmount(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`
  return String(amount)
}

export function formatNumber(value: number): string {
  return wholeNumber.format(value)
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

/** 29 Oct 2026 */
export function formatDate(value: ISODate): string {
  const d = parseISODate(value)
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Thursday, 29 October 2026 */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Thu 29 Oct */
export function formatDayShort(date: Date): string {
  return `${SHORT_WEEKDAYS[date.getDay()]} ${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`
}

/** 29 Oct */
export function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`
}

/** October 2026 */
export function formatMonth(key: MonthKey): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
}

/** Oct */
export function formatMonthShort(key: MonthKey): string {
  return SHORT_MONTHS[Number(key.slice(5, 7)) - 1]
}

export function formatTimeOfDay(date: Date): string {
  return date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
}

/** "Just now", "12 min ago", "Today, 14:05", "Yesterday, 09:30", "27 Oct, 16:10" */
export function formatRelative(value: ISODateTime, now: Date = new Date()): string {
  const date = new Date(value)
  const diffMinutes = Math.round((now.getTime() - date.getTime()) / 60_000)
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  const dayDiff = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000)
  const time = formatTimeOfDay(date)
  if (dayDiff === 0) return `Today, ${time}`
  if (dayDiff === 1) return `Yesterday, ${time}`
  return `${formatDayMonth(date)}, ${time}`
}

export function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Normalises any input to "+998 90 123 45 67" when it has 9 or 12 digits. */
export function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (digits.length === 9) digits = `998${digits}`
  if (digits.length !== 12 || !digits.startsWith('998')) return value.trim()
  return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length === 9 || (digits.length === 12 && digits.startsWith('998'))
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

// ---- Labels for stored enum values ----

export const studentStatusLabel: Record<StudentStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  left: 'Left',
}

export const teacherStatusLabel: Record<TeacherStatus, string> = {
  active: 'Teaching',
  on_leave: 'On leave',
}

export const groupStatusLabel: Record<GroupStatus, string> = {
  active: 'Running',
  paused: 'Paused',
  completed: 'Completed',
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card (Uzcard/Humo)',
  click: 'Click',
  payme: 'Payme',
  transfer: 'Bank transfer',
}

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  paid: 'Paid',
  pending: 'Pending',
  refunded: 'Refunded',
}

export const attendanceMarkLabel: Record<AttendanceMark, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
}

export const dayPatternLabel: Record<DayPattern, string> = {
  odd: 'Mon, Wed, Fri',
  even: 'Tue, Thu, Sat',
}

export const dayPatternShort: Record<DayPattern, string> = {
  odd: 'Odd days',
  even: 'Even days',
}
