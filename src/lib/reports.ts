// Calculations behind the extra reports: profit, retention, rankings and
// teacher performance. Every number is built from records the app keeps, so
// each report can say exactly how it was worked out.

import type { MonthKey, SchoolData } from '../types'
import { monthKeyOf } from './dates'
import { revenueInMonth, summarizeMarks } from './metrics'
import { teacherSalary } from './salary'

export interface ProfitMonth {
  key: MonthKey
  /** Paid tuition received in the month (by payment date). */
  revenue: number
  /** Expenses dated in the month. */
  expenses: number
  /** Teacher pay earned for the month (salary rules), whether paid out yet or not. */
  teacherPay: number
  profit: number
}

/**
 * Revenue − expenses − teacher pay, per month. Staff salaries entered as
 * expenses are counted once, as expenses; teacher pay comes from the salary
 * rules so it isn't entered twice.
 */
export function profitByMonth(data: SchoolData, keys: MonthKey[]): ProfitMonth[] {
  return keys.map((key) => {
    const revenue = revenueInMonth(data, key).total
    const expenses = data.expenses.filter((e) => monthKeyOf(e.date) === key).reduce((s, e) => s + e.amount, 0)
    const teacherPay = data.teachers.reduce((s, t) => s + teacherSalary(data, t.id, key).amount, 0)
    return { key, revenue, expenses, teacherPay, profit: revenue - expenses - teacherPay }
  })
}

export interface ExpenseCategoryTotal {
  categoryId: string
  total: number
}

export function expensesByCategory(data: SchoolData, from: MonthKey): ExpenseCategoryTotal[] {
  const totals = new Map<string, number>()
  for (const e of data.expenses) if (monthKeyOf(e.date) >= from) totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount)
  return [...totals].map(([categoryId, total]) => ({ categoryId, total })).sort((a, b) => b.total - a.total)
}

export interface Retention {
  /** Students who were studying (active or paused) at the start of the period. */
  atStart: number
  left: number
  graduated: number
  paused: number
  /** Share of the students at the start who did not leave (graduating isn't leaving). */
  rate: number | null
  /** Why people left, most common first. The part before ":" is the reason from the list. */
  reasons: { reason: string; count: number }[]
}

const LEFT = 'Left the centre'
const GRADUATED = 'Graduated'
const PAUSED = 'Paused'

/** Leavers, graduates and pauses from the student history, from the first day of `from`. */
export function retention(data: SchoolData, from: MonthKey): Retention {
  const start = `${from}-01`
  const events = data.studentEvents.filter((e) => e.type === 'status_changed' && e.on >= start)
  const leftEvents = events.filter((e) => e.title === LEFT)
  const leftIds = new Set(leftEvents.map((e) => e.studentId))
  // Studying at the start: enrolled before it, and not already gone by then.
  const goneBefore = new Set(
    data.studentEvents.filter((e) => e.type === 'status_changed' && e.on < start && (e.title === LEFT || e.title === GRADUATED)).map((e) => e.studentId),
  )
  const reenrolled = new Set(data.studentEvents.filter((e) => e.type === 'status_changed' && e.on < start && e.title === 'Back to active').map((e) => e.studentId))
  const atStart = data.students.filter((s) => s.enrolledOn < start && (!goneBefore.has(s.id) || reenrolled.has(s.id))).length
  const leftOfThose = data.students.filter((s) => s.enrolledOn < start && leftIds.has(s.id)).length

  const reasons = new Map<string, number>()
  for (const e of leftEvents) {
    const reason = (e.detail ?? '').split(':')[0].trim() || 'No reason given'
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
  }
  return {
    atStart,
    left: leftEvents.length,
    graduated: events.filter((e) => e.title === GRADUATED).length,
    paused: events.filter((e) => e.title === PAUSED).length,
    rate: atStart > 0 ? (atStart - leftOfThose) / atStart : null,
    reasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
  }
}

export interface StudentRank {
  studentId: string
  name: string
  groupId: string | null
  /** Average homework score (0–100) from scored homework set in the period. */
  homework: number | null
  homeworkCount: number
  /** Average test result as a percentage of the maximum. */
  tests: number | null
  testCount: number
  /** Share of counted lessons attended (present or late). */
  attendance: number | null
  /** The ranking score: the average of the parts that have data, 0–100. */
  score: number | null
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)

/**
 * Active students ranked by the plain average of homework score, test
 * percentage and attendance in the period. A part with no data is left out
 * rather than counted as zero; students with nothing at all are not ranked.
 */
export function studentRanking(data: SchoolData, from: MonthKey): StudentRank[] {
  const start = `${from}-01`
  const homeworkIn = new Set(data.homework.filter((h) => h.assignedOn >= start).map((h) => h.id))
  const hw = new Map<string, number[]>()
  for (const r of data.homeworkResults) {
    if (!homeworkIn.has(r.homeworkId) || !r.evaluation) continue
    hw.set(r.studentId, [...(hw.get(r.studentId) ?? []), r.evaluation.score])
  }
  const tests = new Map<string, number[]>()
  for (const a of data.assessments) {
    if (a.date < start || a.maxScore <= 0) continue
    for (const r of a.results) if (r.score !== null) tests.set(r.studentId, [...(tests.get(r.studentId) ?? []), (r.score / a.maxScore) * 100])
  }
  const came = new Map<string, { yes: number; total: number }>()
  for (const rec of data.attendance) {
    if (rec.date < start) continue
    for (const [studentId, mark] of Object.entries(rec.marks)) {
      if (mark === 'excused') continue
      const c = came.get(studentId) ?? { yes: 0, total: 0 }
      c.total += 1
      if (mark === 'present' || mark === 'late') c.yes += 1
      came.set(studentId, c)
    }
  }
  return data.students
    .filter((s) => s.status === 'active')
    .map((s) => {
      const homework = avg(hw.get(s.id) ?? [])
      const test = avg(tests.get(s.id) ?? [])
      const c = came.get(s.id)
      const attendance = c && c.total > 0 ? c.yes / c.total : null
      const parts = [homework, test, attendance === null ? null : attendance * 100].filter((x): x is number => x !== null)
      return {
        studentId: s.id,
        name: s.fullName,
        groupId: s.groupId,
        homework,
        homeworkCount: hw.get(s.id)?.length ?? 0,
        tests: test,
        testCount: tests.get(s.id)?.length ?? 0,
        attendance,
        score: parts.length ? Math.round(avg(parts)!) : null,
      }
    })
    .filter((r) => r.score !== null)
    .sort((a, b) => b.score! - a.score! || a.name.localeCompare(b.name))
}

export interface GroupRank {
  groupId: string
  name: string
  students: number
  attendance: number | null
  homework: number | null
  tests: number | null
  score: number | null
}

/** Running groups ranked the same way, from their students' results. */
export function groupRanking(data: SchoolData, from: MonthKey): GroupRank[] {
  const students = studentRanking(data, from)
  const start = `${from}-01`
  return data.groups
    .filter((g) => g.status === 'active')
    .map((g) => {
      const mine = students.filter((s) => s.groupId === g.id)
      const marks = summarizeMarks(data.attendance.filter((r) => r.groupId === g.id && r.date >= start))
      const homework = avg(mine.flatMap((s) => (s.homework === null ? [] : [s.homework])))
      const tests = avg(mine.flatMap((s) => (s.tests === null ? [] : [s.tests])))
      const parts = [homework, tests, marks.rate === null ? null : marks.rate * 100].filter((x): x is number => x !== null)
      return {
        groupId: g.id,
        name: g.name,
        students: data.students.filter((s) => s.groupId === g.id && s.status === 'active').length,
        attendance: marks.rate,
        homework,
        tests,
        score: parts.length ? Math.round(avg(parts)!) : null,
      }
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name))
}

export interface TeacherPerformance {
  teacherId: string
  name: string
  groups: number
  students: number
  attendance: number | null
  /** Share of handed-in homework that was scored. */
  homeworkChecked: number | null
  averageTest: number | null
  /** Pay earned for `month` under their salary rule. */
  pay: number
}

export function teacherPerformance(data: SchoolData, from: MonthKey, month: MonthKey): TeacherPerformance[] {
  const start = `${from}-01`
  return data.teachers
    .filter((t) => t.status === 'active')
    .map((t) => {
      const groups = data.groups.filter((g) => g.teacherId === t.id && g.status === 'active')
      const ids = new Set(groups.map((g) => g.id))
      const marks = summarizeMarks(data.attendance.filter((r) => ids.has(r.groupId) && r.date >= start))
      const hwIds = new Set(data.homework.filter((h) => h.teacherId === t.id && h.assignedOn >= start).map((h) => h.id))
      const handed = data.homeworkResults.filter((r) => hwIds.has(r.homeworkId) && r.submission !== 'not_submitted')
      const testScores = data.assessments
        .filter((a) => ids.has(a.groupId) && a.date >= start && a.maxScore > 0)
        .flatMap((a) => a.results.flatMap((r) => (r.score === null ? [] : [(r.score / a.maxScore) * 100])))
      return {
        teacherId: t.id,
        name: t.fullName,
        groups: groups.length,
        students: data.students.filter((s) => s.status === 'active' && s.groupId && ids.has(s.groupId)).length,
        attendance: marks.rate,
        homeworkChecked: handed.length ? handed.filter((r) => r.evaluation).length / handed.length : null,
        averageTest: avg(testScores),
        pay: teacherSalary(data, t.id, month).amount,
      }
    })
    .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name))
}
