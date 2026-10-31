// Numbers for the teacher portal. Every function expects data already
// scoped to one teacher (see lib/scope.ts), so "all groups" means theirs.

import type { Homework, SchoolData } from '../../types'
import { addDays, toISODate } from '../../lib/dates'
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

/** The next classes that haven't started, soonest first. */
export function upcomingClasses(data: SchoolData, now: Date, limit: number): Session[] {
  const found: Session[] = []
  for (let i = 0; i < 8 && found.length < limit; i++) {
    const date = toISODate(addDays(now, i))
    found.push(...sessionsOn(data, date, now).filter((s) => s.status === 'upcoming'))
  }
  return found.slice(0, limit)
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
