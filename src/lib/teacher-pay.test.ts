import { describe, expect, it } from 'vitest'
import type { SchoolData } from '../types'
import { createDemoData, DATA_VERSION } from '../data/seed'
import { migrate } from '../data/migrate'
import { validateSchoolData } from '../data/storage'
import { teacherSalary } from './salary'
import { BONUS_PLACES, RATING_WEIGHTS, teacherRatings } from './rating'

const NOW = new Date(2026, 10, 3, 16, 0) // Tue 3 Nov 2026
const data = createDemoData(NOW)

describe('teacher salary', () => {
  it('is the teacher’s share of tuition their students paid for the month', () => {
    const month = '2026-10'
    const salary = teacherSalary(data, 'tch_03', month)
    const teacher = data.teachers.find((t) => t.id === 'tch_03')!
    const groupIds = new Set(data.groups.filter((g) => g.teacherId === 'tch_03').map((g) => g.id))
    const studentIds = new Set(data.students.filter((s) => s.groupId && groupIds.has(s.groupId)).map((s) => s.id))
    const expected = data.payments
      .filter((p) => p.status === 'paid' && p.period === month && studentIds.has(p.studentId))
      .reduce((sum, p) => sum + p.amount, 0)
    expect(salary.collected).toBe(expected)
    expect(salary.percent).toBe(teacher.salaryPercent)
    expect(Math.abs(salary.amount - (expected * teacher.salaryPercent) / 100)).toBeLessThan(salary.lines.length + 1)
    expect(salary.groups.reduce((sum, g) => sum + g.share, 0)).toBe(salary.amount)
  })

  it('follows a change to the teacher’s share', () => {
    const changed: SchoolData = { ...data, teachers: data.teachers.map((t) => (t.id === 'tch_03' ? { ...t, salaryPercent: 30 } : t)) }
    const at50 = teacherSalary({ ...data, teachers: data.teachers.map((t) => (t.id === 'tch_03' ? { ...t, salaryPercent: 50 } : t)) }, 'tch_03', '2026-10')
    const at30 = teacherSalary(changed, 'tch_03', '2026-10')
    expect(at30.collected).toBe(at50.collected)
    expect(at30.amount).toBeLessThan(at50.amount)
  })
})

describe('teacher rating', () => {
  const ratings = teacherRatings(data, '2026-10', NOW)

  it('scores every active teacher with groups from 0 to 100, best first', () => {
    expect(Object.values(RATING_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
    expect(ratings.length).toBeGreaterThan(BONUS_PLACES)
    for (const r of ratings) {
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(100)
    }
    for (let i = 1; i < ratings.length; i++) expect(ratings[i - 1].score).toBeGreaterThanOrEqual(ratings[i].score)
    expect(ratings[0].rank).toBe(1)
    expect(ratings.some((r) => r.teacherId === 'tch_10')).toBe(false) // on leave
  })

  it('rewards recording lessons', () => {
    const target = ratings[ratings.length - 1]
    const groupIds = new Set(data.groups.filter((g) => g.teacherId === target.teacherId).map((g) => g.id))
    const fewer = { ...data, attendance: data.attendance.filter((r) => !(groupIds.has(r.groupId) && r.date.startsWith('2026-10'))) }
    const after = teacherRatings(fewer, '2026-10', NOW).find((r) => r.teacherId === target.teacherId)!
    expect(after.parts.lessonsRecorded).toBe(0)
  })
})

describe('lesson grades in saved data', () => {
  it('only grades students who came, on the 1–5 scale', () => {
    let graded = 0
    for (const r of data.attendance) {
      for (const [studentId, grade] of Object.entries(r.grades ?? {})) {
        graded += 1
        expect(r.marks[studentId]).not.toBe('absent')
        expect([1, 2, 3, 4, 5]).toContain(grade)
      }
    }
    expect(graded).toBeGreaterThan(100)
  })

  it('upgrades version 3 data with a salary share and sample grades', () => {
    const v3 = {
      ...data,
      version: 3,
      teachers: data.teachers.map(({ salaryPercent: _s, ...t }) => t),
      attendance: data.attendance.map(({ grades: _g, ...r }) => r),
    }
    const upgraded = migrate(JSON.parse(JSON.stringify(v3)), DATA_VERSION, NOW) as unknown as SchoolData
    expect(validateSchoolData(upgraded)).toBeNull()
    expect(upgraded.teachers.every((t) => t.salaryPercent > 0)).toBe(true)
    expect(upgraded.attendance.some((r) => r.grades)).toBe(true)
  })
})
