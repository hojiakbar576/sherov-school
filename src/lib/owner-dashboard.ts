// The owner's executive dashboard: one month's numbers for the whole school or
// one branch, the plain-language conclusions drawn from them, and the short
// list of things to act on. Everything is calculated from stored records with
// the same functions the rest of the app uses; when the records needed for a
// number don't exist, the number is reported as missing (null / has* flags),
// never as zero performance.

import type { ISODate, Lead, MonthKey, SchoolData } from '../types'
import { addDays, addMonths, monthKey, monthKeyOf, monthRange, toISODate } from './dates'
import { formatMonth, formatMonthShort, formatPercent, formatUZSCompact } from './format'
import { attentionItems, cameToClass, computeBalances, outstandingTotal, revenueInMonth, summarizeMarks } from './metrics'
import { change, leftInMonth, paidUpTo } from './owner'
import { profitByMonth } from './reports'
import { tr } from '../i18n'

// ---------------------------------------------------------------- study start

/**
 * The first class each of these students actually attended (present or late)
 * on or after the day they enrolled. Being enrolled or put in a group is not
 * a study start; absent and excused marks don't count.
 */
export function firstAttendedClass(data: SchoolData, studentIds: ReadonlySet<string>): Map<string, ISODate> {
  const enrolledOn = new Map(data.students.filter((s) => studentIds.has(s.id)).map((s) => [s.id, s.enrolledOn]))
  const first = new Map<string, ISODate>()
  for (const record of data.attendance) {
    for (const [studentId, mark] of Object.entries(record.marks)) {
      const from = enrolledOn.get(studentId)
      if (from === undefined || !cameToClass(mark) || record.date < from) continue
      const known = first.get(studentId)
      if (!known || record.date < known) first.set(studentId, record.date)
    }
  }
  return first
}

// ---------------------------------------------------------------- one month

export interface LeadCohort {
  /** Enquiries created in the month. */
  enquiries: number
  /** Of those, enrolled as a student (whenever that happened). */
  enrolled: number
  /** Of those enrolled, attended at least one class. */
  started: number
  enrolledNotStarted: number
}

export function leadCohort(data: SchoolData, leads: Lead[]): LeadCohort {
  const enrolledLeads = leads.filter((l) => l.stage === 'enrolled' && l.studentId)
  const started = firstAttendedClass(data, new Set(enrolledLeads.map((l) => l.studentId!)))
  const startedCount = enrolledLeads.filter((l) => started.has(l.studentId!)).length
  return { enquiries: leads.length, enrolled: enrolledLeads.length, started: startedCount, enrolledNotStarted: enrolledLeads.length - startedCount }
}

export interface OwnerMonth {
  month: MonthKey
  /** Students active today (a past month can't be reconstructed, so this is always "now"). */
  activeStudents: number
  joined: number
  left: number
  net: number
  /** Paid tuition with a payment date in the month. */
  collected: number
  payments: number
  /** Everything owed today by active students, and the part past its due day. */
  outstanding: number
  owingStudents: number
  overdue: number
  overdueStudents: number
  /** Present or late ÷ marks in the month; null without attendance records. */
  attendanceRate: number | null
  attendanceMarks: number
  leads: LeadCohort
  /** Whether any records of each kind exist at all (so "0" can be told from "no data"). */
  has: { students: boolean; payments: boolean; attendance: boolean; leads: boolean; expenses: boolean }
}

/** `data` is the whole school or one branch (lib/owner branchData). */
export function ownerMonth(data: SchoolData, month: MonthKey, now: Date): OwnerMonth {
  const owing = outstandingTotal(computeBalances(data, now))
  const revenue = revenueInMonth(data, month)
  const marks = summarizeMarks(data.attendance.filter((r) => r.date.startsWith(month)))
  const joined = data.students.filter((s) => s.enrolledOn.startsWith(month)).length
  const left = leftInMonth(data, month)
  return {
    month,
    activeStudents: data.students.filter((s) => s.status === 'active').length,
    joined,
    left,
    net: joined - left,
    collected: revenue.total,
    payments: revenue.count,
    outstanding: owing.total,
    owingStudents: owing.students,
    overdue: owing.overdueTotal,
    overdueStudents: owing.overdueStudents,
    attendanceRate: marks.rate,
    attendanceMarks: marks.total,
    leads: leadCohort(data, data.leads.filter((l) => monthKeyOf(l.createdAt.slice(0, 10)) === month)),
    has: {
      students: data.students.length > 0,
      payments: data.payments.length > 0,
      attendance: data.attendance.length > 0,
      leads: data.leads.length > 0,
      expenses: data.expenses.length > 0,
    },
  }
}

/** True when the school (or branch) has no records the dashboard could report on. */
export function isEmpty(m: OwnerMonth): boolean {
  return !m.has.students && !m.has.payments && !m.has.attendance && !m.has.leads
}

// ---------------------------------------------------------------- what this means

export interface Insight {
  key: string
  tone: 'good' | 'neutral' | 'watch'
  text: string
}

export interface BranchMonth {
  id: string
  name: string
  m: OwnerMonth
}

const MIN_SOURCE_LEADS = 5

/** Enrolment rate per enquiry source over a few months; only sources with enough enquiries to judge. */
export function sourceConversion(leads: Lead[]): { source: string; leads: number; enrolled: number; rate: number }[] {
  const by = new Map<string, { leads: number; enrolled: number }>()
  for (const l of leads) {
    if (!l.source) continue
    const row = by.get(l.source) ?? { leads: 0, enrolled: 0 }
    row.leads += 1
    if (l.stage === 'enrolled') row.enrolled += 1
    by.set(l.source, row)
  }
  return [...by]
    .filter(([, r]) => r.leads >= MIN_SOURCE_LEADS)
    .map(([source, r]) => ({ source, ...r, rate: r.enrolled / r.leads }))
    .sort((a, b) => b.rate - a.rate)
}

/**
 * Short statements the numbers support. Each rule only fires when its data
 * exists; none of them states a cause.
 */
export function ownerInsights(input: { data: SchoolData; current: OwnerMonth; previous: OwnerMonth; branches: BranchMonth[]; now: Date }): Insight[] {
  const { data, current: m, previous, branches, now } = input
  const out: Insight[] = []
  const isThisMonth = m.month === monthKey(now)
  const monthName = formatMonth(m.month)

  if (m.has.students && (m.joined > 0 || m.left > 0)) {
    out.push(
      m.net > 0
        ? { key: 'growth', tone: 'good', text: tr("The student count grew by {0} in {1}: {2} joined and {3} left.", m.net, monthName, m.joined, m.left) }
        : m.net < 0
          ? { key: 'growth', tone: 'watch', text: tr("The student count fell by {0} in {1}: {2} joined and {3} left.", -m.net, monthName, m.joined, m.left) }
          : { key: 'growth', tone: 'neutral', text: tr("The student count is unchanged in {0}: {1} joined and {1} left.", monthName, m.joined) },
    )
  }

  if (m.has.payments) {
    // Mid-month, compare with the same day last month so an unfinished month doesn't look like a drop.
    const base = isThisMonth ? paidUpTo(data, previous.month, now.getDate()) : previous.collected
    const diff = change(m.collected, base)
    if (diff !== null && Math.abs(diff) >= 0.05) {
      out.push({
        key: 'collected',
        tone: diff > 0 ? 'good' : 'watch',
        text: isThisMonth
          ? diff > 0
            ? tr("Collected {0} so far, {1} more than by the same day last month.", formatUZSCompact(m.collected), formatPercent(diff))
            : tr("Collected {0} so far, {1} less than by the same day last month.", formatUZSCompact(m.collected), formatPercent(-diff))
          : diff > 0
            ? tr("Collected {0}, {1} more than the month before.", formatUZSCompact(m.collected), formatPercent(diff))
            : tr("Collected {0}, {1} less than the month before.", formatUZSCompact(m.collected), formatPercent(-diff)),
      })
    }
  }

  if (m.overdue > 0) {
    const withDebt = branches.filter((b) => b.m.overdue > 0).sort((a, b) => b.m.overdue - a.m.overdue)
    if (branches.length > 1 && withDebt.length > 1) {
      out.push({ key: 'overdue', tone: 'watch', text: tr("{0} has the most overdue tuition: {1} of {2} in total.", withDebt[0].name, formatUZSCompact(withDebt[0].m.overdue), formatUZSCompact(m.overdue)) })
    } else {
      out.push({ key: 'overdue', tone: 'watch', text: tr("{0} students are past the due day and owe {1}.", m.overdueStudents, formatUZSCompact(m.overdue)) })
    }
  }

  if (m.attendanceRate !== null && previous.attendanceRate !== null && m.attendanceMarks >= 20 && previous.attendanceMarks >= 20) {
    const points = Math.round((m.attendanceRate - previous.attendanceRate) * 100)
    if (Math.abs(points) >= 5) {
      out.push({
        key: 'attendance',
        tone: points > 0 ? 'good' : 'watch',
        text:
          points > 0
            ? tr("Attendance is {0}, up {1} points on {2}.", formatPercent(m.attendanceRate), points, formatMonthShort(previous.month))
            : tr("Attendance is {0}, down {1} points on {2}.", formatPercent(m.attendanceRate), -points, formatMonthShort(previous.month)),
      })
    }
  }

  if (m.leads.enrolledNotStarted > 0) {
    out.push({ key: 'not-started', tone: 'watch', text: tr("{0} of the {1} people enrolled from {2}’s enquiries have not attended a class yet.", m.leads.enrolledNotStarted, m.leads.enrolled, monthName) })
  }

  // Sources over the last three months, so there are enough enquiries to compare.
  const from = `${addMonths(m.month, -2)}-01`
  const sources = sourceConversion(data.leads.filter((l) => l.createdAt.slice(0, 10) >= from && monthKeyOf(l.createdAt.slice(0, 10)) <= m.month))
  if (sources.length >= 2 && sources[0].rate > sources[sources.length - 1].rate) {
    const best = sources[0]
    const worst = sources[sources.length - 1]
    out.push({
      key: 'sources',
      tone: 'neutral',
      text: tr("Over the last 3 months, {0} enquiries enrol most often ({1} of {2}); {3} least ({4} of {5}).", best.source, best.enrolled, best.leads, worst.source, worst.enrolled, worst.leads),
    })
  }

  return out.slice(0, 5)
}

// ---------------------------------------------------------------- needs attention

export interface OwnerAttention {
  key: 'attendance' | 'overdue' | 'waiting' | 'not-started' | 'absences'
  tone: 'danger' | 'watch'
  label: string
  detail: string
  count: number
  /** A page in the branch pages, already filtered. */
  to: string
}

export const LEAD_WAITING_DAYS = 3

/** At most five things worth acting on, most urgent first. */
export function ownerAttention(data: SchoolData, m: OwnerMonth, now: Date): OwnerAttention[] {
  const items = attentionItems(data, now, computeBalances(data, now))
  const of = (kind: (typeof items)[number]['kind']) => items.filter((i) => i.kind === kind)
  const out: OwnerAttention[] = []

  const missing = of('attendance_missing')
  if (missing.length) {
    const first = [...missing].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0]
    out.push({ key: 'attendance', tone: 'danger', label: tr("Classes without attendance"), detail: tr("Ended in the last 7 days with no attendance taken"), count: missing.length, to: `/attendance?group=${first.groupId}&date=${first.date}` })
  }

  if (m.overdueStudents > 0) {
    out.push({ key: 'overdue', tone: 'danger', label: tr("Overdue tuition"), detail: tr("{0} owed past the due day", formatUZSCompact(m.overdue)), count: m.overdueStudents, to: '/students?tuition=overdue' })
  }

  const cutoff = toISODate(addDays(now, -LEAD_WAITING_DAYS))
  const waiting = data.leads.filter((l) => l.stage === 'new' && l.createdAt.slice(0, 10) <= cutoff)
  if (waiting.length) {
    out.push({ key: 'waiting', tone: 'watch', label: tr("Enquiries waiting {0}+ days", LEAD_WAITING_DAYS), detail: tr("Still at the first stage, not yet contacted"), count: waiting.length, to: '/leads?view=list&stage=new' })
  }

  // Everyone enrolled through admissions who has still never attended, not only this month's.
  const enrolled = data.leads.filter((l) => l.stage === 'enrolled' && l.studentId)
  const active = new Set(data.students.filter((s) => s.status === 'active').map((s) => s.id))
  const started = firstAttendedClass(data, new Set(enrolled.map((l) => l.studentId!)))
  const notStarted = enrolled.filter((l) => active.has(l.studentId!) && !started.has(l.studentId!))
  if (notStarted.length) {
    out.push({ key: 'not-started', tone: 'watch', label: tr("Enrolled but not started"), detail: tr("Enrolled through admissions, no class attended yet"), count: notStarted.length, to: '/leads?view=list&stage=enrolled' })
  }

  const absences = of('absences')
  if (absences.length) {
    out.push({ key: 'absences', tone: 'watch', label: tr("Repeated absences"), detail: tr("Missed 3 or more classes in the last two weeks"), count: absences.length, to: '/students' })
  }

  return out.slice(0, 5)
}

// ---------------------------------------------------------------- 12-month finance

export interface FinanceMonth {
  key: MonthKey
  label: string
  fullLabel: string
  income: number
  /** Recorded expenses (rent, marketing, staff…). */
  expenses: number
  /** Teacher pay worked out from the pay rules (lib/salary). */
  salaries: number
  /** Income − expenses − salaries; null when the month has income but no costs recorded at all. */
  profit: number | null
}

export function financeByMonth(data: SchoolData, now: Date, months = 12): { rows: FinanceMonth[]; hasAny: boolean; monthsWithoutCosts: number } {
  const last = monthKey(now)
  const rows = profitByMonth(data, monthRange(addMonths(last, -(months - 1)), last)).map((p) => {
    const noCosts = p.revenue > 0 && p.expenses === 0 && p.teacherPay === 0
    return { key: p.key, label: formatMonthShort(p.key), fullLabel: formatMonth(p.key), income: p.revenue, expenses: p.expenses, salaries: p.teacherPay, profit: noCosts ? null : p.profit }
  })
  return {
    rows,
    hasAny: rows.some((r) => r.income > 0 || r.expenses > 0 || r.salaries > 0),
    monthsWithoutCosts: rows.filter((r) => r.income > 0 && r.expenses === 0).length,
  }
}
