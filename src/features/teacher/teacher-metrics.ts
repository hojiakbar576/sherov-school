// Numbers for the teacher portal. Every function expects data already
// scoped to one teacher (see lib/scope.ts), so "all groups" means theirs.

import type { AttendanceRecord, Grade, Group, Homework, ISODate, MonthKey, SchoolData } from '../../types'
import { addDays, daysInMonth, isoWeekday, parseISODate, toISODate } from '../../lib/dates'
import { meetsOnWeekday } from '../../lib/schedule'
import { sessionsOn, type Session } from '../../lib/metrics'

/** Classes from the last week that have started but have no attendance yet. */
export function attendanceTasks(data: SchoolData, now: Date): Session[] {
  const tasks: Session[] = []
  for (let i = 0; i < 7; i++) {
    const date = toISODate(addDays(now, -i))
    tasks.push(...sessionsOn(data, date, now).filter((s) => s.status === 'in_progress' || s.status === 'not_recorded'))
  }
  return tasks
}

/** Homework split into what's still due and what's past its deadline. */
export function splitHomework(items: Homework[], now: Date) {
  const today = toISODate(now)
  const current = items.filter((h) => h.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const past = items.filter((h) => h.dueDate < today).sort((a, b) => b.dueDate.localeCompare(a.dueDate))
  return { current, past }
}

/** Tone for an attendance rate: under 75% needs a look, under 60% is a concern. */
export function rateTone(rate: number | null): string {
  if (rate === null) return 'text-ink-faint'
  if (rate < 0.6) return 'text-danger'
  if (rate < 0.75) return 'text-warning'
  return 'text-ink'
}

/** Every date in the month the group meets on, plus any date it has a saved lesson. */
export function lessonDates(group: Group, records: AttendanceRecord[], month: MonthKey): ISODate[] {
  const dates = new Set<ISODate>()
  for (let d = 1; d <= daysInMonth(month); d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`
    if (meetsOnWeekday(group, isoWeekday(parseISODate(date)))) dates.add(date)
  }
  for (const r of records) if (r.groupId === group.id && r.date.startsWith(month)) dates.add(r.date)
  return [...dates].sort()
}

/** Lessons before today in the last `days` days that still have no attendance. */
export function unmarkedLessons(group: Group, records: AttendanceRecord[], now: Date, days = 14): ISODate[] {
  if (group.status !== 'active') return []
  const today = toISODate(now)
  const saved = new Set(records.filter((r) => r.groupId === group.id).map((r) => r.date))
  const out: ISODate[] = []
  for (let i = days; i >= 1; i--) {
    const date = toISODate(addDays(now, -i))
    if (date < today && meetsOnWeekday(group, isoWeekday(parseISODate(date))) && !saved.has(date)) out.push(date)
  }
  return out
}

/** Average of the grades a student got in the given lessons, or null. */
export function averageGrade(records: AttendanceRecord[], studentId: string): number | null {
  const grades = records.map((r) => r.grades?.[studentId]).filter((g): g is Grade => g !== undefined)
  return grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null
}
