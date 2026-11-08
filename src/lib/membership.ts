// Which groups a student is in. A student has a main group (`groupId`) and may
// also study in other groups (`extraGroupIds`), with one shared balance.

import type { Student } from '../types'

/** Every group the student is in, main group first. */
export function groupIdsOf(s: Pick<Student, 'groupId' | 'extraGroupIds'>): string[] {
  const ids = s.groupId ? [s.groupId] : []
  for (const id of s.extraGroupIds ?? []) if (!ids.includes(id)) ids.push(id)
  return ids
}

/** Is the student in this group (as their main group or an extra one)? */
export function inGroup(s: Pick<Student, 'groupId' | 'extraGroupIds'>, groupId: string | null | undefined): boolean {
  return !!groupId && (s.groupId === groupId || (s.extraGroupIds?.includes(groupId) ?? false))
}

/** Is the student in any of these groups? */
export function inAnyGroup(s: Pick<Student, 'groupId' | 'extraGroupIds'>, groupIds: ReadonlySet<string>): boolean {
  return groupIdsOf(s).some((id) => groupIds.has(id))
}
