// Every number shown in the app is derived here from the shared records, so
// the dashboard, reports and list pages can never disagree with each other.

import type { AttendanceMark, AttendanceRecord, Group, ISODate, MonthKey, SchoolData, Student, Teacher } from '../types'
import { HISTORY_MONTHS } from '../data/seed'
import {
  addDays,
  addMonths,
  atTime,
  minutesSinceMidnight,
  monthKey,
  monthKeyOf,
  monthRange,
  startOfWeek,
  timeToMinutes,
  toISODate,
} from './dates'
import { formatDayMonth, formatDayShort, formatMonth, formatMonthShort, formatUZS } from './format'
import { endTime, meetsOn } from './schedule'

// ---------------------------------------------------------------- tuition

export type TuitionStatus = 'paid' | 'due' | 'overdue' | 'inactive'

export interface TuitionBalance {
  owed: number
  /** Months with an unpaid amount, oldest first. */
  unpaidMonths: MonthKey[]
  paidThisMonth: number
  status: TuitionStatus
}

/** First month the demo bills for. Earlier months are treated as settled. */
export function billingStartMonth(data: SchoolData): MonthKey {
  return addMonths(monthKey(new Date(data.seededAt)), -(HISTORY_MONTHS - 1))
}

/**
 * What each student owes: monthly tuition for every month from enrolment (or
 * the start of the demo history) up to this month, minus paid payments for
 * those months. Only active students are billed. Unpaid tuition becomes
 * overdue after the due day of the month.
 */
export function computeBalances(data: SchoolData, now: Date): Map<string, TuitionBalance> {
  const currentMonth = monthKey(now)
  const start = billingStartMonth(data)

  const paid = new Map<string, number>() // `${studentId}|${period}` -> amount
  for (const p of data.payments) {
    if (p.status !== 'paid') continue
    const key = `${p.studentId}|${p.period}`
    paid.set(key, (paid.get(key) ?? 0) + p.amount)
  }

  const balances = new Map<string, TuitionBalance>()
  for (const s of data.students) {
    const paidThisMonth = paid.get(`${s.id}|${currentMonth}`) ?? 0
    if (s.status !== 'active') {
      balances.set(s.id, { owed: 0, unpaidMonths: [], paidThisMonth, status: 'inactive' })
      continue
    }
    const enrolledMonth = monthKeyOf(s.enrolledOn)
    const first = enrolledMonth > start ? enrolledMonth : start
    let owed = 0
    let overdue = false
    const unpaidMonths: MonthKey[] = []
    for (const period of first <= currentMonth ? monthRange(first, currentMonth) : []) {
      const shortfall = Math.max(0, s.monthlyTuition - (paid.get(`${s.id}|${period}`) ?? 0))
      if (shortfall === 0) continue
      owed += shortfall
      unpaidMonths.push(period)
      if (period < currentMonth || now.getDate() > data.settings.tuitionDueDay) overdue = true
    }
    balances.set(s.id, {
      owed,
      unpaidMonths,
      paidThisMonth,
      status: owed === 0 ? 'paid' : overdue ? 'overdue' : 'due',
    })
  }
  return balances
}

export function outstandingTotal(balances: Map<string, TuitionBalance>) {
  let total = 0
  let students = 0
  let overdueStudents = 0
  for (const b of balances.values()) {
    if (b.owed > 0) {
      total += b.owed
      students += 1
      if (b.status === 'overdue') overdueStudents += 1
    }
  }
  return { total, students, overdueStudents }
}

// ---------------------------------------------------------------- revenue

/** Collected money: payments with status "paid", by the date they were made. */
export function revenueInMonth(data: SchoolData, key: MonthKey) {
  let total = 0
  let count = 0
  for (const p of data.payments) {
    if (p.status === 'paid' && monthKeyOf(p.date) === key) {
      total += p.amount
      count += 1
    }
  }
  return { total, count }
}

export interface RevenuePoint {
  key: string
  label: string
  fullLabel: string
  total: number
}

export function revenueByMonth(data: SchoolData, now: Date, months: number): RevenuePoint[] {
  const last = monthKey(now)
  return monthRange(addMonths(last, -(months - 1)), last).map((key) => ({
    key,
    label: formatMonthShort(key),
    fullLabel: formatMonth(key),
    total: revenueInMonth(data, key).total,
  }))
}

export function revenueByWeek(data: SchoolData, now: Date, weeks: number): RevenuePoint[] {
  const thisWeek = startOfWeek(now)
  const points: RevenuePoint[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i)
    const from = toISODate(start)
    const to = toISODate(addDays(start, 6))
    const total = data.payments
      .filter((p) => p.status === 'paid' && p.date >= from && p.date <= to)
      .reduce((sum, p) => sum + p.amount, 0)
    points.push({
      key: from,
      label: formatDayMonth(start),
      fullLabel: `Week of ${formatDayShort(start)}`,
      total,
    })
  }
  return points
}

// ---------------------------------------------------------------- groups & rosters

export function enrolmentByGroup(data: SchoolData): Map<string, number> {
  const counts = new Map<string, number>()
  for (const s of data.students) {
    if (s.status === 'active' && s.groupId) counts.set(s.groupId, (counts.get(s.groupId) ?? 0) + 1)
  }
  return counts
}

/** Active students in a group who had enrolled by `date`. */
export function groupRoster(data: SchoolData, groupId: string, date: ISODate): Student[] {
  return data.students
    .filter((s) => s.groupId === groupId && s.status === 'active' && s.enrolledOn <= date)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
}

export function lookups(data: SchoolData) {
  return {
    student: new Map<string, Student>(data.students.map((s) => [s.id, s])),
    group: new Map<string, Group>(data.groups.map((g) => [g.id, g])),
    teacher: new Map<string, Teacher>(data.teachers.map((t) => [t.id, t])),
  }
}

// ---------------------------------------------------------------- attendance

export interface MarkSummary {
  present: number
  late: number
  absent: number
  total: number
  /** Share of marks that were present or late (late still attended). */
  rate: number | null
}

export function summarizeMarks(records: AttendanceRecord[]): MarkSummary {
  const summary = { present: 0, late: 0, absent: 0, total: 0 }
  for (const r of records) {
    for (const mark of Object.values(r.marks) as AttendanceMark[]) {
      summary[mark] += 1
      summary.total += 1
    }
  }
  return { ...summary, rate: summary.total ? (summary.present + summary.late) / summary.total : null }
}

export function recordsOn(data: SchoolData, date: ISODate) {
  return data.attendance.filter((r) => r.date === date)
}

export function findRecord(data: SchoolData, groupId: string, date: ISODate) {
  return data.attendance.find((r) => r.groupId === groupId && r.date === date)
}

export interface DayAttendance extends MarkSummary {
  date: ISODate
  label: string
  isFuture: boolean
  sessionsPlanned: number
  sessionsRecorded: number
}

/** Monday to Saturday of the current week. */
export function weekAttendance(data: SchoolData, now: Date): DayAttendance[] {
  const today = toISODate(now)
  const monday = startOfWeek(now)
  return Array.from({ length: 6 }, (_, i) => {
    const day = addDays(monday, i)
    const date = toISODate(day)
    const records = recordsOn(data, date)
    return {
      ...summarizeMarks(records),
      date,
      label: day.toLocaleDateString('en-GB', { weekday: 'short' }),
      isFuture: date > today,
      sessionsPlanned: data.groups.filter((g) => meetsOn(g, date)).length,
      sessionsRecorded: records.length,
    }
  })
}

/** Absences per student since `since` (inclusive). */
export function absencesSince(data: SchoolData, since: ISODate): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of data.attendance) {
    if (r.date < since) continue
    for (const [studentId, mark] of Object.entries(r.marks)) {
      if (mark === 'absent') counts.set(studentId, (counts.get(studentId) ?? 0) + 1)
    }
  }
  return counts
}

export function studentAttendance(data: SchoolData, studentId: string) {
  const history: { date: ISODate; groupId: string; mark: AttendanceMark }[] = []
  for (const r of data.attendance) {
    const mark = r.marks[studentId]
    if (mark) history.push({ date: r.date, groupId: r.groupId, mark })
  }
  history.sort((a, b) => b.date.localeCompare(a.date))
  const attended = history.filter((h) => h.mark !== 'absent').length
  return { history, rate: history.length ? attended / history.length : null }
}

// ---------------------------------------------------------------- today's classes

export type SessionStatus = 'upcoming' | 'in_progress' | 'recorded' | 'not_recorded'

export interface Session {
  group: Group
  teacher: Teacher | undefined
  date: ISODate
  start: string
  end: string
  enrolled: number
  status: SessionStatus
  record: AttendanceRecord | undefined
}

export function sessionsOn(data: SchoolData, date: ISODate, now: Date): Session[] {
  const { teacher } = lookups(data)
  const enrolment = enrolmentByGroup(data)
  const today = toISODate(now)
  const nowMinutes = minutesSinceMidnight(now)
  return data.groups
    .filter((g) => meetsOn(g, date))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name))
    .map((group) => {
      const record = findRecord(data, group.id, date)
      const start = timeToMinutes(group.startTime)
      const finish = start + group.durationMinutes
      let status: SessionStatus
      if (record) status = 'recorded'
      else if (date > today || (date === today && nowMinutes < start)) status = 'upcoming'
      else if (date === today && nowMinutes < finish) status = 'in_progress'
      else status = 'not_recorded'
      return {
        group,
        teacher: teacher.get(group.teacherId),
        date,
        start: group.startTime,
        end: endTime(group),
        enrolled: enrolment.get(group.id) ?? 0,
        status,
        record,
      }
    })
}

// ---------------------------------------------------------------- needs attention

export type AttentionKind = 'overdue' | 'absences' | 'capacity' | 'attendance_missing'

export interface AttentionItem {
  id: string
  kind: AttentionKind
  title: string
  reason: string
  /** Higher sorts first within its kind. */
  weight: number
  studentId?: string
  groupId?: string
  date?: ISODate
}

export const ABSENCE_WINDOW_DAYS = 14
export const ABSENCE_THRESHOLD = 3

export function attentionItems(data: SchoolData, now: Date, balances: Map<string, TuitionBalance>): AttentionItem[] {
  const items: AttentionItem[] = []
  const { student, group } = lookups(data)

  for (const [studentId, b] of balances) {
    if (b.status !== 'overdue') continue
    const s = student.get(studentId)
    if (!s) continue
    const months = b.unpaidMonths.map(formatMonthShort).join(', ')
    items.push({
      id: `overdue:${studentId}:${b.owed}`,
      kind: 'overdue',
      title: s.fullName,
      reason: `${formatUZS(b.owed)} unpaid tuition (${months})`,
      weight: b.owed,
      studentId,
    })
  }

  const since = toISODate(addDays(now, -(ABSENCE_WINDOW_DAYS - 1)))
  for (const [studentId, count] of absencesSince(data, since)) {
    const s = student.get(studentId)
    if (!s || s.status !== 'active' || count < ABSENCE_THRESHOLD) continue
    items.push({
      id: `absences:${studentId}:${count}`,
      kind: 'absences',
      title: s.fullName,
      reason: `${count} absences in the last ${ABSENCE_WINDOW_DAYS} days (${group.get(s.groupId ?? '')?.name ?? 'no group'})`,
      weight: count,
      studentId,
    })
  }

  const enrolment = enrolmentByGroup(data)
  for (const g of data.groups) {
    if (g.status !== 'active') continue
    const count = enrolment.get(g.id) ?? 0
    const seatsLeft = g.capacity - count
    if (seatsLeft > 1) continue
    items.push({
      id: `capacity:${g.id}:${count}`,
      kind: 'capacity',
      title: g.name,
      reason: seatsLeft <= 0 ? `Full: ${count} of ${g.capacity} seats taken` : `1 seat left: ${count} of ${g.capacity} taken`,
      weight: count / g.capacity,
      groupId: g.id,
    })
  }

  // Sessions in the last 7 days that ended without attendance being recorded.
  for (let i = 0; i < 7; i++) {
    const date = toISODate(addDays(now, -i))
    for (const session of sessionsOn(data, date, now)) {
      if (session.status !== 'not_recorded') continue
      items.push({
        id: `missing:${session.group.id}:${date}`,
        kind: 'attendance_missing',
        title: session.group.name,
        reason: `Attendance not recorded for ${formatDayShort(atTime(date, session.start))}, ${session.start}`,
        weight: -i,
        groupId: session.group.id,
        date,
      })
    }
  }

  return items.sort((a, b) => (a.kind === b.kind ? b.weight - a.weight : 0))
}

// ---------------------------------------------------------------- enrolment

export function enrolmentByMonth(data: SchoolData, now: Date, months: number) {
  const last = monthKey(now)
  return monthRange(addMonths(last, -(months - 1)), last).map((key) => ({
    key,
    label: formatMonthShort(key),
    fullLabel: formatMonth(key),
    joined: data.students.filter((s) => monthKeyOf(s.enrolledOn) === key).length,
  }))
}
