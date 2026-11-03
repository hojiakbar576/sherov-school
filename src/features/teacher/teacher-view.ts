import { useCallback, useState } from 'react'
import type { TeacherView } from '../../data/school-context'
import type { TeacherRating } from '../../lib/rating'

const HIDE_KEY = 'sherov-school:hide-salary'

/** Salary is hidden by default (as in LC UP) so it isn't on show to students looking at the screen. */
export function useSalaryHidden(): [boolean, () => void] {
  const [hidden, setHidden] = useState(() => {
    try {
      return window.localStorage.getItem(HIDE_KEY) !== '0'
    } catch {
      return true
    }
  })
  const toggle = useCallback(() => {
    setHidden((h) => {
      try {
        window.localStorage.setItem(HIDE_KEY, h ? '0' : '1')
      } catch {
        // Not important enough to report.
      }
      return !h
    })
  }, [])
  return [hidden, toggle]
}

/** "8 523 000" with spaces, as amounts are written in Uzbekistan. */
export function formatSum(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export function myRating(view: TeacherView, monthIndex = 0): { mine: TeacherRating | undefined; total: number; month: string } {
  const entry = view.ratings[monthIndex]
  return { mine: entry.rows.find((r) => r.teacherId === view.teacher.id), total: entry.rows.length, month: entry.month }
}

