// The owner's view of the whole organisation: one summary per branch, built
// from the same rules the administrators see (each branch's numbers are
// exactly what its administrator's dashboard shows), and totals across them.
// Needs the full, unscoped data.

import type { AttentionKind } from './metrics'
import type { Branch, MonthKey, SchoolData, User } from '../types'
import { addDays, addMonths, monthKey, monthRange, toISODate } from './dates'
import { formatMonth, formatMonthShort } from './format'
import { attentionItems, computeBalances, enrolmentByGroup, outstandingTotal, revenueInMonth, summarizeMarks } from './metrics'
import { isOpenLead } from './admissions'
import { scopeData } from './scope'
import { teacherSalary } from './salary'

/** Paid tuition in a month, counting only payments on or before that day of the month. */
function paidUpTo(data: SchoolData, month: MonthKey, day: number): number {
  const last = `${month}-${String(day).padStart(2, '0')}`
  return data.payments.filter((p) => p.status === 'paid' && p.date.startsWith(month) && p.date <= last).reduce((sum, p) => sum + p.amount, 0)
}

/** Exactly what the branch's administrator sees. */
export function branchData(data: SchoolData, branchId: string): SchoolData {
  const asAdmin: User = { id: `view_${branchId}`, role: 'admin', fullName: '', username: '', branchId }
  return scopeData(data, asAdmin)
}

export interface BranchSummary {
  branch: Branch
  adminName: string | null
  activeStudents: number
  pausedStudents: number
  runningGroups: number
  activeTeachers: number
  /** Active students ÷ seats in running groups. */
  fill: number | null
  revenueThisMonth: number
  revenueLastMonth: number
  /** Last month up to the same day of the month, for a fair comparison mid-month. */
  revenueLastMonthToDate: number
  /** Everything owed by active students. */
  owed: number
  overdue: number
  overdueStudents: number
  /** Present or late ÷ all marks, last 30 days. */
  attendanceRate: number | null
  newStudentsThisMonth: number
  /** Students who left or graduated this month. */
  leftThisMonth: number
  openLeads: number
  /** Enrolled ÷ (enrolled + lost) for enquiries from the last 90 days. */
  conversion: number | null
  /** Teacher pay for this month so far (each teacher's share of tuition paid for the month). */
  teacherPayThisMonth: number
  /** Today's tasks for the branch, by kind. */
  tasks: Partial<Record<AttentionKind, number>>
}

export function branchSummary(data: SchoolData, branch: Branch, now: Date): BranchSummary {
  const d = branchData(data, branch.id)
  const month = monthKey(now)
  const balances = computeBalances(d, now)
  const owing = outstandingTotal(balances)
  const enrolment = enrolmentByGroup(d)
  const running = d.groups.filter((g) => g.status === 'active')
  const seats = running.reduce((sum, g) => sum + g.capacity, 0)
  const active = d.students.filter((s) => s.status === 'active').length
  const since = toISODate(addDays(now, -30))
  const recent90 = toISODate(addDays(now, -90))
  const closed = d.leads.filter((l) => (l.stage === 'enrolled' || l.stage === 'lost') && l.createdAt.slice(0, 10) >= recent90)
  const tasks: Partial<Record<AttentionKind, number>> = {}
  for (const item of attentionItems(d, now, balances)) tasks[item.kind] = (tasks[item.kind] ?? 0) + 1

  return {
    branch,
    adminName: data.users.find((u) => u.role === 'admin' && u.branchId === branch.id)?.fullName ?? null,
    activeStudents: active,
    pausedStudents: d.students.filter((s) => s.status === 'paused').length,
    runningGroups: running.length,
    activeTeachers: d.teachers.filter((t) => t.status === 'active').length,
    fill: seats ? running.reduce((sum, g) => sum + (enrolment.get(g.id) ?? 0), 0) / seats : null,
    revenueThisMonth: revenueInMonth(d, month).total,
    revenueLastMonth: revenueInMonth(d, addMonths(month, -1)).total,
    revenueLastMonthToDate: paidUpTo(d, addMonths(month, -1), now.getDate()),
    owed: owing.total,
    overdue: owing.overdueTotal,
    overdueStudents: owing.overdueStudents,
    attendanceRate: summarizeMarks(d.attendance.filter((r) => r.date >= since)).rate,
    newStudentsThisMonth: d.students.filter((s) => s.enrolledOn.startsWith(month)).length,
    leftThisMonth: d.studentEvents.filter((e) => e.type === 'status_changed' && e.on.startsWith(month) && (e.title === 'Left the centre' || e.title === 'Graduated')).length,
    openLeads: d.leads.filter(isOpenLead).length,
    conversion: closed.length ? closed.filter((l) => l.stage === 'enrolled').length / closed.length : null,
    // Salary is worked out on the full data: a teacher's students all belong to their branch.
    teacherPayThisMonth: d.teachers.reduce((sum, t) => sum + teacherSalary(data, t.id, month).amount, 0),
    tasks,
  }
}

export function branchSummaries(data: SchoolData, now: Date): BranchSummary[] {
  return data.branches.map((b) => branchSummary(data, b, now))
}

/** Totals across branches. Rates are recomputed from the parts, not averaged. */
export function organisationTotals(data: SchoolData, rows: BranchSummary[], now: Date) {
  const sum = (pick: (r: BranchSummary) => number) => rows.reduce((total, r) => total + pick(r), 0)
  const since = toISODate(addDays(now, -30))
  const enrolment = enrolmentByGroup(data)
  const running = data.groups.filter((g) => g.status === 'active')
  const seats = running.reduce((total, g) => total + g.capacity, 0)
  return {
    activeStudents: sum((r) => r.activeStudents),
    pausedStudents: sum((r) => r.pausedStudents),
    runningGroups: sum((r) => r.runningGroups),
    activeTeachers: sum((r) => r.activeTeachers),
    revenueThisMonth: sum((r) => r.revenueThisMonth),
    revenueLastMonth: sum((r) => r.revenueLastMonth),
    revenueLastMonthToDate: sum((r) => r.revenueLastMonthToDate),
    owed: sum((r) => r.owed),
    overdue: sum((r) => r.overdue),
    overdueStudents: sum((r) => r.overdueStudents),
    newStudentsThisMonth: sum((r) => r.newStudentsThisMonth),
    leftThisMonth: sum((r) => r.leftThisMonth),
    openLeads: sum((r) => r.openLeads),
    teacherPayThisMonth: sum((r) => r.teacherPayThisMonth),
    attendanceRate: summarizeMarks(data.attendance.filter((r) => r.date >= since)).rate,
    fill: seats ? running.reduce((total, g) => total + (enrolment.get(g.id) ?? 0), 0) / seats : null,
  }
}

export interface MonthlyRevenueRow {
  month: MonthKey
  label: string
  fullLabel: string
  /** Paid tuition by branch id. */
  byBranch: Record<string, number>
  total: number
}

/** Paid tuition per branch for the last `months` months, oldest first. */
export function revenueByBranch(data: SchoolData, now: Date, months: number): MonthlyRevenueRow[] {
  const last = monthKey(now)
  const views = data.branches.map((b) => [b.id, branchData(data, b.id)] as const)
  return monthRange(addMonths(last, -(months - 1)), last).map((month) => {
    const byBranch = Object.fromEntries(views.map(([id, d]) => [id, revenueInMonth(d, month).total]))
    return { month, label: formatMonthShort(month), fullLabel: formatMonth(month), byBranch, total: Object.values(byBranch).reduce((a, b) => a + b, 0) }
  })
}

/** Change from last month as a ratio (0.1 = +10%), or null without a base. */
export function change(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null
}
