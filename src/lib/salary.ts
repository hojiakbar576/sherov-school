// Teacher pay. A teacher earns a share (Teacher.salaryPercent) of the tuition
// their students actually paid for a month. Shares are set per teacher by the
// administrator, so one teacher can get 50% and another 30%.
//
// Needs the full (unscoped) data: teachers never see payments themselves,
// only the result of this calculation for their own pay.

import type { MonthKey, SchoolData } from '../types'
import { addMonths } from './dates'

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
  /** What the teacher earns: collected × percent. */
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
  const percent = teacher?.salaryPercent ?? 0
  const groups = new Map(data.groups.filter((g) => g.teacherId === teacherId).map((g) => [g.id, g]))
  const students = new Map(data.students.filter((s) => s.groupId && groups.has(s.groupId)).map((s) => [s.id, s]))

  const byStudent = new Map<string, number>()
  for (const p of data.payments) {
    if (p.status !== 'paid' || p.period !== month || !students.has(p.studentId)) continue
    byStudent.set(p.studentId, (byStudent.get(p.studentId) ?? 0) + p.amount)
  }

  const lines: SalaryLine[] = [...byStudent].map(([studentId, paid]) => {
    const student = students.get(studentId)!
    const group = groups.get(student.groupId!)!
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
    amount: lines.reduce((sum, l) => sum + l.share, 0),
    lines,
    groups: [...groupTotals.values()].sort((a, b) => b.share - a.share),
  }
}

/** The last `count` months of salary, newest first. */
export function salaryHistory(data: SchoolData, teacherId: string, current: MonthKey, count: number): SalaryMonth[] {
  return Array.from({ length: count }, (_, i) => teacherSalary(data, teacherId, addMonths(current, -i)))
}
