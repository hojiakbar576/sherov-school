// A student's journey at the centre: which group they were in and when, and
// what happened to them (joined, moved, paused, left, graduated). These pure
// functions keep `Student.groupId` and the group history (`enrollments`) in
// step and add timeline events, so nothing is lost when someone changes group
// or leaves. A future database can run the same rules on the server.

import type { Enrollment, ISODate, SchoolData, Student, StudentEvent, StudentStatus } from '../types'
import { ARCHIVED_STUDENT_STATUSES } from '../types'
import { createId } from './id'
import { formatUZS, studentStatusLabel } from './format'
import { tr } from '../i18n'

const statusTitle: Record<StudentStatus, string> = {
  active: 'Back to active',
  paused: 'Paused',
  left: 'Left the centre',
  graduated: 'Graduated',
}

export function isArchived(status: StudentStatus): boolean {
  return ARCHIVED_STUDENT_STATUSES.includes(status)
}

interface Change {
  /** The student before the change; undefined for a new student. */
  before: Student | undefined
  after: Student
  on: ISODate
  reason?: string
  byUserId?: string
}

/**
 * Writes the student and records what changed: closes and opens group
 * memberships and adds timeline events. Use for every student change.
 */
export function applyStudentChange(d: SchoolData, { before, after, on, reason, byUserId }: Change): SchoolData {
  const now = new Date().toISOString()
  const groupName = (id: string | null) => d.groups.find((g) => g.id === id)?.name ?? 'a group'
  const events: StudentEvent[] = []
  const add = (type: StudentEvent['type'], title: string, detail?: string) =>
    events.push({ id: createId('evt'), studentId: after.id, type, on, title, ...(detail ? { detail } : {}), ...(byUserId ? { byUserId } : {}), at: now })

  let enrollments: Enrollment[] = d.enrollments
  const groupChanged = (before?.groupId ?? null) !== after.groupId
  if (groupChanged) {
    const endReason = after.groupId
      ? `Transferred to ${groupName(after.groupId)}${reason ? `: ${reason}` : ''}`
      : reason || statusTitle[after.status]
    // Close the open membership, if there is one.
    enrollments = enrollments.map((e) => (e.studentId === after.id && !e.endedOn ? { ...e, endedOn: on, endReason } : e))
    if (after.groupId) {
      enrollments = [...enrollments, { id: createId('enr'), studentId: after.id, groupId: after.groupId, branchId: after.branchId, startedOn: on }]
    }
  }

  if (!before) {
    add('enrolled', 'Enrolled', after.groupId ? `Joined ${groupName(after.groupId)}` : 'No group yet')
  } else {
    if (groupChanged && before.groupId && after.groupId) add('transferred', `Moved from ${groupName(before.groupId)} to ${groupName(after.groupId)}`, reason)
    else if (groupChanged && after.groupId) add('enrolled', `Joined ${groupName(after.groupId)}`, reason)
    if (before.status !== after.status) add('status_changed', statusTitle[after.status], reason || `Was ${studentStatusLabel[before.status].toLowerCase()}`)
    if (before.monthlyTuition !== after.monthlyTuition) {
      add(
        'tuition_changed',
        'Monthly tuition changed',
        `${formatUZS(before.monthlyTuition)} → ${formatUZS(after.monthlyTuition)}${after.tuitionAdjustment ? `. ${after.tuitionAdjustment.reason}` : ''}`,
      )
    }
  }

  return {
    ...d,
    students: before ? d.students.map((s) => (s.id === after.id ? after : s)) : [...d.students, after],
    enrollments,
    studentEvents: [...d.studentEvents, ...events],
  }
}

/** A student's group memberships, newest first. */
export function groupHistory(d: SchoolData, studentId: string): Enrollment[] {
  return d.enrollments.filter((e) => e.studentId === studentId).sort((a, b) => b.startedOn.localeCompare(a.startedOn) || (a.endedOn ? 1 : -1))
}

export interface TimelineItem {
  id: string
  on: ISODate
  kind: StudentEvent['type'] | 'payment'
  title: string
  detail?: string
}

/** Everything that happened to a student, newest first, with payments mixed in. */
export function studentTimeline(d: SchoolData, studentId: string): TimelineItem[] {
  const items: TimelineItem[] = d.studentEvents
    .filter((e) => e.studentId === studentId)
    .map((e) => ({ id: e.id, on: e.on, kind: e.type, title: e.title, detail: e.detail }))
  for (const p of d.payments) {
    if (p.studentId !== studentId) continue
    items.push({ id: p.id, on: p.date, kind: 'payment', title: tr("Paid {0}", formatUZS(p.amount)), detail: p.status === 'paid' ? undefined : tr("Status: {0}", p.status) })
  }
  return items.sort((a, b) => b.on.localeCompare(a.on))
}
