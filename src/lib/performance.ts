// A student's homework results and simple progress indicators.
// These are descriptive only: each number stands on its own and nothing here
// combines attendance and homework into a rank. A future rating formula, or a
// parent's view of their child, can read the same functions.

import type { Homework, HomeworkEvaluation, HomeworkResult, SchoolData } from '../types'
import { toISODate } from './dates'
import { studentAttendance } from './metrics'
import { tr } from '../i18n'

/** What a teacher (or later a parent) sees for one student's homework. */
export type ResultStatus = 'not_submitted' | 'submitted' | 'late' | 'evaluated'

export const resultStatusLabel: Record<ResultStatus, string> = {
  not_submitted: tr("Not submitted"),
  submitted: tr("Submitted"),
  late: tr("Late"),
  evaluated: tr("Evaluated"),
}

export function resultStatus(result: HomeworkResult | undefined): ResultStatus {
  if (!result) return 'not_submitted'
  if (result.evaluation) return 'evaluated'
  return result.submission
}

export interface HomeworkLine {
  homework: Homework
  result?: HomeworkResult
  status: ResultStatus
  /** The deadline has passed. */
  due: boolean
}

/** Every homework a student was set, newest first, with their result. */
export function studentHomework(data: SchoolData, studentId: string, now: Date): HomeworkLine[] {
  const today = toISODate(now)
  const results = new Map(data.homeworkResults.filter((r) => r.studentId === studentId).map((r) => [r.homeworkId, r]))
  return data.homework
    .filter((h) => h.studentIds.includes(studentId))
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.assignedOn.localeCompare(a.assignedOn))
    .map((homework) => {
      const result = results.get(homework.id)
      return { homework, result, status: resultStatus(result), due: homework.dueDate < today }
    })
}

export type Trend = 'improving' | 'steady' | 'declining'
export type PerformanceLabel = 'excellent' | 'good' | 'needs_improvement'

export const performanceLabelText: Record<PerformanceLabel, string> = {
  excellent: tr("Excellent"),
  good: tr("Good"),
  needs_improvement: tr("Needs improvement"),
}

export const trendText: Record<Trend, string> = {
  improving: 'Improving',
  steady: 'Steady',
  declining: 'Declining',
}

export interface PerformanceSummary {
  /** Homework set for the student. */
  assigned: number
  /** Of those, how many are past their deadline. */
  pastDeadline: number
  submitted: number
  late: number
  evaluated: number
  /** Past the deadline and never handed in. */
  missing: number
  averageScore: number | null
  /** Handed in (on time or late) ÷ homework past its deadline. */
  completionRate: number | null
  attendanceRate: number | null
  /** Scores oldest first, for a small trend chart. */
  scores: { homework: Homework; score: number }[]
  trend: Trend | null
  /** From the average homework score only. */
  label: PerformanceLabel | null
  recentFeedback: { homework: Homework; evaluation: HomeworkEvaluation }[]
}

/** Thresholds for the indicative label. Not a ranking: easy to change later. */
export const LABEL_THRESHOLDS = { excellent: 85, good: 70, minEvaluated: 2 }

export function studentPerformance(data: SchoolData, studentId: string, now: Date): PerformanceSummary {
  const lines = studentHomework(data, studentId, now)
  const pastDeadline = lines.filter((l) => l.due)
  const handedIn = (l: HomeworkLine) => l.result !== undefined && l.result.submission !== 'not_submitted'
  const evaluated = lines.filter((l) => l.result?.evaluation)
  const scores = evaluated
    .map((l) => ({ homework: l.homework, score: l.result!.evaluation!.score }))
    .sort((a, b) => a.homework.dueDate.localeCompare(b.homework.dueDate))
  const averageScore = scores.length ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length : null

  let trend: Trend | null = null
  if (scores.length >= 4) {
    const recent = scores.slice(-3)
    const before = scores.slice(-6, -3)
    const avg = (xs: typeof scores) => xs.reduce((sum, s) => sum + s.score, 0) / xs.length
    const change = avg(recent) - avg(before)
    trend = change >= 5 ? 'improving' : change <= -5 ? 'declining' : 'steady'
  }

  let label: PerformanceLabel | null = null
  if (averageScore !== null && scores.length >= LABEL_THRESHOLDS.minEvaluated) {
    label = averageScore >= LABEL_THRESHOLDS.excellent ? 'excellent' : averageScore >= LABEL_THRESHOLDS.good ? 'good' : 'needs_improvement'
  }

  return {
    assigned: lines.length,
    pastDeadline: pastDeadline.length,
    submitted: lines.filter(handedIn).length,
    late: lines.filter((l) => l.result?.submission === 'late').length,
    evaluated: evaluated.length,
    missing: pastDeadline.filter((l) => !handedIn(l)).length,
    averageScore,
    completionRate: pastDeadline.length ? pastDeadline.filter(handedIn).length / pastDeadline.length : null,
    attendanceRate: studentAttendance(data, studentId).rate,
    scores,
    trend,
    label,
    recentFeedback: evaluated
      .filter((l) => l.result!.evaluation!.feedback)
      .sort((a, b) => b.result!.evaluation!.evaluatedAt.localeCompare(a.result!.evaluation!.evaluatedAt))
      .slice(0, 3)
      .map((l) => ({ homework: l.homework, evaluation: l.result!.evaluation! })),
  }
}

export interface HomeworkProgress {
  assigned: number
  handedIn: number
  late: number
  evaluated: number
  /** Handed in but not scored yet. */
  toEvaluate: number
  averageScore: number | null
}

/** Counts for one assignment across the students it was set for. */
export function homeworkProgress(data: SchoolData, homework: Homework): HomeworkProgress {
  const results = data.homeworkResults.filter((r) => r.homeworkId === homework.id && homework.studentIds.includes(r.studentId))
  const handedIn = results.filter((r) => r.submission !== 'not_submitted')
  const scored = results.filter((r) => r.evaluation)
  return {
    assigned: homework.studentIds.length,
    handedIn: handedIn.length,
    late: results.filter((r) => r.submission === 'late').length,
    evaluated: scored.length,
    toEvaluate: handedIn.filter((r) => !r.evaluation).length,
    averageScore: scored.length ? scored.reduce((sum, r) => sum + r.evaluation!.score, 0) / scored.length : null,
  }
}
