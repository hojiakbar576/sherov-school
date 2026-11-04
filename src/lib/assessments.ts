// Tests and exams: summaries for an assessment and a student's results.
// Scores stay on the assessment's own scale (e.g. 34 out of 50); percentages
// are only for comparing. Nothing here combines assessments with homework or
// attendance: a ranking formula is still to be agreed.

import type { Assessment, AssessmentKind, AssessmentResult, SchoolData } from '../types'

export const assessmentKindLabel: Record<AssessmentKind, string> = {
  level: 'Level test',
  monthly: 'Monthly test',
  midterm: 'Midterm',
  final: 'Final exam',
  other: 'Other',
}

export interface AssessmentSummary {
  /** Students with a score. */
  taken: number
  absent: number
  average: number | null
  /** Average as a share of the maximum. */
  averagePercent: number | null
  highest: number | null
  lowest: number | null
}

export function summarizeAssessment(a: Assessment): AssessmentSummary {
  const scores = a.results.map((r) => r.score).filter((s): s is number => s !== null)
  const average = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : null
  return {
    taken: scores.length,
    absent: a.results.filter((r) => r.score === null).length,
    average,
    averagePercent: average === null ? null : average / a.maxScore,
    highest: scores.length ? Math.max(...scores) : null,
    lowest: scores.length ? Math.min(...scores) : null,
  }
}

/** A student's assessment results, newest first. */
export function studentAssessments(data: SchoolData, studentId: string): { assessment: Assessment; result: AssessmentResult; percent: number | null }[] {
  return data.assessments
    .flatMap((assessment) => {
      const result = assessment.results.find((r) => r.studentId === studentId)
      return result ? [{ assessment, result, percent: result.score === null ? null : result.score / assessment.maxScore }] : []
    })
    .sort((a, b) => b.assessment.date.localeCompare(a.assessment.date))
}
