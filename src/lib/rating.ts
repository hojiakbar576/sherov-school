// Teacher rating: one score out of 100 per month, so the owner can see who is
// putting in the most effort (top 3 can get a bonus). It measures things the
// teacher controls day to day, not how generous their grades are.
//
// Change the weights here; everything else (cards, leaderboard) follows.
// Needs the full (unscoped) data because it compares every teacher.

import type { ISODate, MonthKey, SchoolData } from '../types'
import { daysInMonth, toISODate } from './dates'
import { meetsOn } from './schedule'
import { tr } from '../i18n'

export const RATING_PARTS = ['lessonsRecorded', 'studentAttendance', 'homeworkChecked', 'gradingActivity', 'groupFill'] as const
export type RatingPart = (typeof RATING_PARTS)[number]

/** Weights add up to 100. */
export const RATING_WEIGHTS: Record<RatingPart, number> = {
  lessonsRecorded: 25,
  studentAttendance: 20,
  homeworkChecked: 20,
  gradingActivity: 15,
  groupFill: 20,
}

export const RATING_PART_LABEL: Record<RatingPart, { title: string; detail: string }> = {
  lessonsRecorded: { title: tr("Lessons recorded"), detail: tr("Lessons with attendance saved, out of all lessons held") },
  studentAttendance: { title: tr("Student attendance"), detail: tr("Students who came to class (late counts as came)") },
  homeworkChecked: { title: tr("Homework checked"), detail: tr("Handed-in homework that you scored") },
  gradingActivity: { title: tr("Students graded"), detail: tr("Students present who got a 1–5 grade in the lesson") },
  groupFill: { title: tr("Groups filled"), detail: tr("Active students out of the seats in your groups") },
}

/** How many teachers each month are in the bonus places. */
export const BONUS_PLACES = 3

export interface TeacherRating {
  teacherId: string
  teacherName: string
  /** 0–100, rounded. */
  score: number
  /** 1 = best. Equal scores share a place. */
  rank: number
  /** Each part as a ratio 0–1, or null when there was nothing to measure. */
  parts: Record<RatingPart, number | null>
  averageGrade: number | null
}

const ratio = (part: number, whole: number) => (whole > 0 ? Math.min(1, part / whole) : null)

/** Ratings for every active teacher with groups, best first. */
export function teacherRatings(data: SchoolData, month: MonthKey, now: Date): TeacherRating[] {
  const today = toISODate(now)
  const lastDay: ISODate = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`
  const inWindow = (date: ISODate) => date.startsWith(month) && date < today && date <= lastDay

  const rows = data.teachers
    .filter((t) => t.status === 'active' && data.groups.some((g) => g.teacherId === t.id && g.status === 'active'))
    .map((teacher) => {
      const groups = data.groups.filter((g) => g.teacherId === teacher.id)
      const groupIds = new Set(groups.map((g) => g.id))
      const records = data.attendance.filter((r) => groupIds.has(r.groupId) && inWindow(r.date))
      const recorded = new Set(records.map((r) => `${r.groupId}|${r.date}`))

      // Lessons that should have happened before today.
      let held = 0
      let saved = 0
      for (let d = 1; d <= daysInMonth(month); d++) {
        const date = `${month}-${String(d).padStart(2, '0')}`
        if (!inWindow(date)) continue
        for (const g of groups) {
          if (!meetsOn(g, date)) continue
          held += 1
          if (recorded.has(`${g.id}|${date}`)) saved += 1
        }
      }

      let marks = 0
      let came = 0
      let gradable = 0
      let graded = 0
      let gradeSum = 0
      for (const r of records) {
        for (const [studentId, mark] of Object.entries(r.marks)) {
          if (mark === 'excused') continue
          marks += 1
          if (mark === 'absent') continue
          came += 1
          gradable += 1
          const grade = r.grades?.[studentId]
          if (grade) {
            graded += 1
            gradeSum += grade
          }
        }
      }

      const homeworkIds = new Set(data.homework.filter((h) => groupIds.has(h.groupId) && inWindow(h.dueDate)).map((h) => h.id))
      let handedIn = 0
      let checked = 0
      for (const res of data.homeworkResults) {
        if (!homeworkIds.has(res.homeworkId) || res.submission === 'not_submitted') continue
        handedIn += 1
        if (res.evaluation) checked += 1
      }

      const active = groups.filter((g) => g.status === 'active')
      const activeIds = new Set(active.map((g) => g.id))
      const seats = active.reduce((sum, g) => sum + g.capacity, 0)
      const enrolled = data.students.filter((s) => s.status === 'active' && s.groupId && activeIds.has(s.groupId)).length

      const parts: Record<RatingPart, number | null> = {
        lessonsRecorded: ratio(saved, held),
        studentAttendance: ratio(came, marks),
        homeworkChecked: ratio(checked, handedIn),
        gradingActivity: ratio(graded, gradable),
        groupFill: ratio(enrolled, seats),
      }
      // Parts with nothing to measure are left out rather than counted as zero.
      let weight = 0
      let total = 0
      for (const part of RATING_PARTS) {
        const value = parts[part]
        if (value === null) continue
        weight += RATING_WEIGHTS[part]
        total += RATING_WEIGHTS[part] * value
      }
      return {
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        score: weight ? Math.round((total / weight) * 100) : 0,
        rank: 0,
        parts,
        averageGrade: graded ? gradeSum / graded : null,
      }
    })

  rows.sort((a, b) => b.score - a.score || a.teacherName.localeCompare(b.teacherName))
  rows.forEach((row, i) => {
    row.rank = i > 0 && rows[i - 1].score === row.score ? rows[i - 1].rank : i + 1
  })
  return rows
}
