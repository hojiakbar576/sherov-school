import type {
  AttendanceMark,
  Catalogs,
  ListItem,
  DayPattern,
  Group,
  Weekday,
  Gender,
  GroupStatus,
  GuardianRelationship,
  ISODate,
  ISODateTime,
  MonthKey,
  PaymentMethod,
  PaymentStatus,
  StudentStatus,
  TeacherStatus,
  TuitionAdjustmentKind,
} from '../types'
import { parseISODate, startOfDay } from './dates'
import { currentLocale, tr } from '../i18n'

/** Locale for the browser's own date formatting (long month and weekday names). */
export const INTL_LOCALE = ({ en: 'en-GB', uz: 'uz-Latn-UZ', ru: 'ru-RU' } as const)[currentLocale]

// Fixed month and weekday abbreviations per language ("Sep", not the en-GB "Sept").
const SHORT_MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
}[currentLocale]
const SHORT_WEEKDAYS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  uz: ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Shan'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
}[currentLocale]

// Browsers have patchy Uzbek date data, so Uzbek long names are spelled out here.
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const UZ_WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']

/** "Monday" / "dushanba" / "понедельник" */
export function longWeekday(date: Date): string {
  return currentLocale === 'uz' ? UZ_WEEKDAYS[date.getDay()] : date.toLocaleDateString(INTL_LOCALE, { weekday: 'long' })
}

/** "Mon" / "Du" / "Пн" for a Date#getDay() number. */
export function shortWeekday(day: number): string {
  return SHORT_WEEKDAYS[day]
}

const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** UZS 1,250,000 */
export function formatUZS(amount: number): string {
  return tr("UZS {0}", wholeNumber.format(Math.round(amount)))
}

/** UZS 86.4M, UZS 650K: for headline figures where precision is not needed. */
export function formatUZSCompact(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000_000) return tr("UZS {0}B", (amount / 1_000_000_000).toFixed(1))
  if (abs >= 1_000_000) return tr("UZS {0}M", (amount / 1_000_000).toFixed(1))
  if (abs >= 1_000) return tr("UZS {0}K", Math.round(amount / 1_000))
  return formatUZS(amount)
}

/** Short axis labels: 86.4M, 650K */
export function formatAxisAmount(amount: number): string {
  if (amount >= 1_000_000) return tr("{0}M", (amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1))
  if (amount >= 1_000) return tr("{0}K", Math.round(amount / 1_000))
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
  if (currentLocale === 'uz') return `${date.getFullYear()}-yil ${date.getDate()}-${UZ_MONTHS[date.getMonth()]}, ${UZ_WEEKDAYS[date.getDay()]}`
  return date.toLocaleDateString(INTL_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
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
  if (currentLocale === 'uz') return `${y}-yil ${UZ_MONTHS[m - 1]}`
  return new Date(y, m - 1, 1).toLocaleDateString(INTL_LOCALE, { month: 'long', year: 'numeric' })
}

/** Oct */
export function formatMonthShort(key: MonthKey): string {
  return SHORT_MONTHS[Number(key.slice(5, 7)) - 1]
}

export function formatTimeOfDay(date: Date): string {
  return date.toLocaleTimeString(INTL_LOCALE, { hour: '2-digit', minute: '2-digit' })
}

/** "Just now", "12 min ago", "Today, 14:05", "Yesterday, 09:30", "27 Oct, 16:10" */
export function formatRelative(value: ISODateTime, now: Date = new Date()): string {
  const date = new Date(value)
  const diffMinutes = Math.round((now.getTime() - date.getTime()) / 60_000)
  if (diffMinutes < 1) return tr("Just now")
  if (diffMinutes < 60) return tr("{0} min ago", diffMinutes)
  const dayDiff = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000)
  const time = formatTimeOfDay(date)
  if (dayDiff === 0) return tr("Today, {0}", time)
  if (dayDiff === 1) return tr("Yesterday, {0}", time)
  return `${formatDayMonth(date)}, ${time}`
}

export function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return tr("Good morning")
  if (hour < 18) return tr("Good afternoon")
  return tr("Good evening")
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

/** Link that dials a phone number. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, '')}`
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
  active: tr("Active"),
  paused: tr("Paused"),
  left: tr("Left"),
  graduated: tr("Graduated"),
}

export const tuitionAdjustmentLabel: Record<TuitionAdjustmentKind, string> = {
  discount: tr("Discount"),
  scholarship: tr("Scholarship"),
  special_price: tr("Special price"),
}

export const teacherStatusLabel: Record<TeacherStatus, string> = {
  active: tr("Teaching"),
  on_leave: tr("On leave"),
}

export const groupStatusLabel: Record<GroupStatus, string> = {
  active: tr("Running"),
  paused: tr("Paused"),
  completed: tr("Completed"),
}

/** Names of the starting payment methods. Use methodName() so renamed or added methods show correctly. */
export const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: tr("Cash"),
  card: tr("Card (Uzcard/Humo)"),
  click: tr("Click"),
  payme: tr("Payme"),
  transfer: tr("Bank transfer"),
}

/** The current name of a payment method id, from the school's own list. */
export function methodName(catalogs: Catalogs, id: PaymentMethod | undefined): string {
  if (!id) return '—'
  const name = catalogs.paymentMethods.find((m) => m.id === id)?.name
  return name ? tr(name) : (paymentMethodLabel[id] ?? id)
}

/** The name of an entry in one of the school's lists (tags, categories, reasons). */
export function listName(items: ListItem[], id: string | undefined): string {
  const name = items.find((x) => x.id === id)?.name
  return name ? tr(name) : '—'
}

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  paid: tr("Paid"),
  pending: tr("Pending"),
  refunded: tr("Refunded"),
}

export const attendanceMarkLabel: Record<AttendanceMark, string> = {
  present: tr("Present"),
  late: tr("Late"),
  absent: tr("Absent"),
  excused: tr("Excused"),
}

export const dayPatternLabel: Record<DayPattern, string> = {
  odd: tr("Mon, Wed, Fri"),
  even: tr("Tue, Thu, Sat"),
}

export const guardianRelationshipLabel: Record<GuardianRelationship, string> = {
  mother: tr("Mother"),
  father: tr("Father"),
  grandmother: tr("Grandmother"),
  grandfather: tr("Grandfather"),
  guardian: tr("Guardian"),
}

export const genderLabel: Record<Gender, string> = {
  female: tr("Female"),
  male: tr("Male"),
}

/** Age in full years on the given day. */
export function ageOn(dateOfBirth: ISODate, now: Date): number {
  const [y, m, d] = dateOfBirth.split('-').map(Number)
  const birthdayPassed = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d)
  return now.getFullYear() - y - (birthdayPassed ? 0 : 1)
}

export const dayPatternShort: Record<DayPattern, string> = {
  odd: tr('Odd days'),
  even: tr('Even days'),
}

export const weekdayShort: Record<Weekday, string> = {
  1: tr("Mon"),
  2: tr("Tue"),
  3: tr("Wed"),
  4: tr("Thu"),
  5: tr("Fri"),
  6: tr("Sat"),
  7: tr("Sun"),
}

/** A group's lesson days, e.g. "Mon, Wed, Fri" or, for other days, "Sat, Sun". */
export function groupDaysLabel(g: Pick<Group, 'days' | 'weekdays'>): string {
  return g.weekdays?.length ? [...g.weekdays].sort().map((d) => weekdayShort[d]).join(', ') : dayPatternLabel[g.days]
}

/** Short form for tight spaces: "Odd days", "Even days" or the actual days. */
export function groupDaysShort(g: Pick<Group, 'days' | 'weekdays'>): string {
  return g.weekdays?.length ? groupDaysLabel(g) : dayPatternShort[g.days]
}
