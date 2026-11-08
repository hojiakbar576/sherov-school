// Teacher pay. A teacher earns a share (Teacher.salaryPercent) of the tuition
// (or a fixed monthly amount, or both: Teacher.salaryKind / fixedSalary)
// their students actually paid for a month. Shares are set per teacher by the
// administrator, so one teacher can get 50% and another 30%.
//
// Needs the full (unscoped) data: teachers never see payments themselves,
// only the result of this calculation for their own pay.

import type { MonthKey, SchoolData, Teacher } from '../types'
import { formatUZS } from './format'
import { addMonths } from './dates'
import { tr } from '../i18n'
import { groupIdsOf } from './membership'

/** How a teacher's pay is worked out, in words. */
export function salaryRuleText(t: Teacher): string {
  const kind = t.salaryKind ?? 'percent'
  if (kind === 'fixed') return tr("Fixed {0} a month", formatUZS(t.fixedSalary ?? 0))
  if (kind === 'mixed') return tr("{0} + {1}% of paid tuition", formatUZS(t.fixedSalary ?? 0), t.salaryPercent)
  return tr("{0}% of paid tuition", t.salaryPercent)
}

export interface SalaryLine {
  studentId: string
  studentName: string
  groupId: string
  groupName: string
  /** Tuition the student paid for the month. */
  paid: number
  /** The teacher's part of it. */
  share: number
}

export interface SalaryGroup {
  groupId: string
  groupName: string
  students: number
  paid: number
  share: number
}

export interface SalaryMonth {
  month: MonthKey
  percent: number
  /** Tuition paid for this month by the teacher's students. */
  collected: number
  /** The tuition share: collected × percent (0 on a fixed salary). */
  share: number
  /** Fixed monthly amount (0 on a percentage salary). */
  fixed: number
  /** What the teacher earns for the month: share + fixed. */
  amount: number
  lines: SalaryLine[]
  groups: SalaryGroup[]
}

/**
 * Salary for one month: paid (not pending or refunded) payments whose period
 * is that month, from students currently in one of the teacher's groups.
 * Students who left a group no longer count for it (their group isn't known).
 */
export function teacherSalary(data: SchoolData, teacherId: string, month: MonthKey): SalaryMonth {
  const teacher = data.teachers.find((t) => t.id === teacherId)
  // "fixed" earns no share; "percent" (the default) and "mixed" do. "fixed" and "mixed" add the fixed amount.
  const kind = teacher?.salaryKind ?? 'percent'
  const percent = kind === 'fixed' ? 0 : (teacher?.salaryPercent ?? 0)
  const fixed = kind === 'percent' ? 0 : (teacher?.fixedSalary ?? 0)
  const groups = new Map(data.groups.filter((g) => g.teacherId === teacherId).map((g) => [g.id, g]))
  const students = new Map(data.students.filter((s) => groupIdsOf(s).some((id) => groups.has(id))).map((s) => [s.id, s]))

  // A payment counts for the group it was paid for; without one, for the student's
  // first group with this teacher. A student in two groups pays each teacher their own share.
  const byLine = new Map<string, { studentId: string; groupId: string; paid: number }>()
  for (const p of data.payments) {
    if (p.status !== 'paid' || p.period !== month || !students.has(p.studentId)) continue
    const student = students.get(p.studentId)!
    const groupId = p.groupId ? (groups.has(p.groupId) ? p.groupId : null) : groupIdsOf(student).find((id) => groups.has(id))
    if (!groupId) continue
    const k = `${p.studentId}|${groupId}`
    const line = byLine.get(k) ?? { studentId: p.studentId, groupId, paid: 0 }
    line.paid += p.amount
    byLine.set(k, line)
  }

  const lines: SalaryLine[] = [...byLine.values()].map(({ studentId, groupId, paid }) => {
    const student = students.get(studentId)!
    const group = groups.get(groupId)!
    return { studentId, studentName: student.fullName, groupId: group.id, groupName: group.name, paid, share: Math.round((paid * percent) / 100) }
  })
  lines.sort((a, b) => a.groupName.localeCompare(b.groupName) || a.studentName.localeCompare(b.studentName))

  const groupTotals = new Map<string, SalaryGroup>()
  for (const line of lines) {
    const g = groupTotals.get(line.groupId) ?? { groupId: line.groupId, groupName: line.groupName, students: 0, paid: 0, share: 0 }
    g.students += 1
    g.paid += line.paid
    g.share += line.share
    groupTotals.set(line.groupId, g)
  }

  const collected = lines.reduce((sum, l) => sum + l.paid, 0)
  return {
    month,
    percent,
    collected,
    share: lines.reduce((sum, l) => sum + l.share, 0),
    fixed,
    amount: lines.reduce((sum, l) => sum + l.share, 0) + fixed,
    lines,
    groups: [...groupTotals.values()].sort((a, b) => b.share - a.share),
  }
}

/** The last `count` months of salary, newest first. */
export function salaryHistory(data: SchoolData, teacherId: string, current: MonthKey, count: number): SalaryMonth[] {
  return Array.from({ length: count }, (_, i) => teacherSalary(data, teacherId, addMonths(current, -i)))
}
