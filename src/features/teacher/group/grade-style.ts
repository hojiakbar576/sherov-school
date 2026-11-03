import type { Grade } from '../../../types'

/** One colour per grade, so a column of grades reads at a glance. */
export const gradeTone: Record<Grade, string> = {
  5: 'bg-success text-white',
  4: 'bg-cat-blue text-white',
  3: 'bg-warning-mark text-ink',
  2: 'bg-danger-mark text-white',
  1: 'bg-danger text-white',
}

export function formatAverage(value: number | null): string {
  return value === null ? '—' : value.toFixed(1)
}

// Homework results are stored out of 100 so older data keeps working; teachers
// see and give them as 1–5 grades. 5 = 100, 4 = 80, 3 = 60, 2 = 40, 1 = 20.
export function gradeToScore(grade: Grade): number {
  return grade * 20
}

export function scoreToGrade(score: number): Grade {
  if (score >= 90) return 5
  if (score >= 70) return 4
  if (score >= 50) return 3
  if (score >= 30) return 2
  return 1
}

/** An average score out of 100 shown as an average grade, e.g. 78 -> "3.9". */
export function formatScoreAsGrade(score: number | null): string {
  return score === null ? '—' : (score / 20).toFixed(1)
}
