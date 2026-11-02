// Upgrades demo data saved by an older version of the app, so nobody loses
// their local changes when the data model grows. Each step takes the shape
// saved by one version and returns the next.

import type { Activity, AttendanceRecord, Group, Homework, SchoolData, Student, Teacher } from '../types'
import { toISODate } from '../lib/dates'
import { BRANCHES, DEFAULT_BRANCH_ID, TEACHER_BRANCH, buildUsers, seedNotifications, ADMIN_USERS } from './seed-portal'
import { homeworkStudents, seedHomework, seedHomeworkResults, seedStudentNotes, studentProfile } from './seed-learning'

type Obj = Record<string, unknown>

/** Version 1 had one centre and no sign-in: add branches, accounts and messages. */
function v1ToV2(old: Obj, now: Date): Obj {
  const teachers = (old.teachers as Omit<Teacher, 'branchId'>[]).map(
    (t): Teacher => ({ ...t, branchId: TEACHER_BRANCH[t.id] ?? DEFAULT_BRANCH_ID }),
  )
  const teacherBranch = new Map(teachers.map((t) => [t.id, t.branchId]))
  const groups = (old.groups as Omit<Group, 'branchId'>[]).map(
    (g): Group => ({ ...g, branchId: teacherBranch.get(g.teacherId) ?? DEFAULT_BRANCH_ID }),
  )
  const groupById = new Map(groups.map((g) => [g.id, g]))
  const students = (old.students as Omit<Student, 'branchId'>[]).map(
    (s): Omit<Student, 'guardians'> => ({ ...s, branchId: groupById.get(s.groupId ?? '')?.branchId ?? DEFAULT_BRANCH_ID }),
  )
  const attendance = (old.attendance as Omit<AttendanceRecord, 'startTime' | 'teacherId'>[]).map(
    (r): AttendanceRecord => {
      const group = groupById.get(r.groupId)
      return { ...r, startTime: group?.startTime ?? '00:00', teacherId: group?.teacherId ?? '' }
    },
  )
  // Notifications that were read stay read for every administrator.
  const read = Array.isArray(old.readNotificationIds) ? (old.readNotificationIds as string[]) : []
  const { readNotificationIds: _dropped, ...rest } = old

  return {
    ...rest,
    version: 2,
    branches: BRANCHES.map((b) => ({ ...b })),
    users: buildUsers(teachers),
    teachers,
    groups,
    students,
    attendance,
    homework: [], // version 3 adds the sample homework
    notifications: seedNotifications(teachers, groups, now),
    activity: old.activity as Activity[],
    notificationReads: Object.fromEntries(ADMIN_USERS.map((u) => [u.id, read])),
  }
}

/**
 * Version 2 had homework without results. Add student profiles and parents,
 * who each homework is for, sample homework history with results, and notes.
 * Homework the teacher created is kept as it was.
 */
function v2ToV3(old: Obj, now: Date): SchoolData {
  const data = old as unknown as Omit<SchoolData, 'homeworkResults' | 'studentNotes'>
  const students = data.students.map((s) => (Array.isArray(s.guardians) ? s : { ...s, ...studentProfile(s, now) }))
  const kept = (data.homework as (Omit<Homework, 'assignedOn' | 'studentIds'> & Partial<Homework>)[]).map((h): Homework => {
    const assignedOn = h.assignedOn ?? toISODate(new Date(h.createdAt))
    return { ...h, assignedOn, studentIds: h.studentIds ?? homeworkStudents(students, h.groupId, assignedOn) }
  })
  const keptIds = new Set(kept.map((h) => h.id))
  const homework = [...kept, ...seedHomework(data.groups, students, now).filter((h) => !keptIds.has(h.id))]
  return {
    ...data,
    version: 3,
    students,
    homework,
    homeworkResults: seedHomeworkResults(homework, now),
    studentNotes: seedStudentNotes(students, data.groups, data.teachers, now),
  }
}

const STEPS: Record<number, (old: Obj, now: Date) => unknown> = { 1: v1ToV2, 2: v2ToV3 }

/**
 * Brings saved data up to `target`. Returns null when there's no upgrade path
 * (e.g. data from a newer version); the caller then keeps a backup.
 */
export function migrate(value: Obj, target: number, now: Date = new Date()): Obj | null {
  let current = value
  try {
    while (current.version !== target) {
      const step = typeof current.version === 'number' ? STEPS[current.version] : undefined
      if (!step) return null
      current = step(current, now) as Obj
    }
    return current
  } catch {
    return null
  }
}
