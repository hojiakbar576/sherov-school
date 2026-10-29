import type { DayPattern, Group, ISODate, Weekday } from '../types'
import { isoWeekday, minutesToTime, parseISODate, timeToMinutes } from './dates'

export const DAY_PATTERN_WEEKDAYS: Record<DayPattern, Weekday[]> = {
  odd: [1, 3, 5],
  even: [2, 4, 6],
}

export function meetsOnWeekday(group: Group, weekday: Weekday): boolean {
  return DAY_PATTERN_WEEKDAYS[group.days].includes(weekday)
}

/** Does this group have a class on this date? Only running groups meet. */
export function meetsOn(group: Group, date: ISODate): boolean {
  return group.status === 'active' && meetsOnWeekday(group, isoWeekday(parseISODate(date)))
}

export function endTime(group: Group): string {
  return minutesToTime(timeToMinutes(group.startTime) + group.durationMinutes)
}

function overlaps(a: Group, b: Group): boolean {
  if (a.days !== b.days) return false
  const aStart = timeToMinutes(a.startTime)
  const bStart = timeToMinutes(b.startTime)
  return aStart < bStart + b.durationMinutes && bStart < aStart + a.durationMinutes
}

/** Running groups that would clash with `candidate` for its teacher or room. */
export function findScheduleConflicts(candidate: Group, groups: Group[]) {
  const others = groups.filter((g) => g.id !== candidate.id && g.status === 'active' && overlaps(g, candidate))
  return {
    teacher: others.find((g) => g.teacherId === candidate.teacherId),
    room: others.find((g) => g.room.trim().toLowerCase() === candidate.room.trim().toLowerCase()),
  }
}
