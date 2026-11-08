// What each signed-in person is allowed to see. Pages read the scoped data,
// so an administrator only ever counts their own branch and a teacher only
// their own groups. When a real backend arrives, the same rules move to
// the server's queries.

import type { Group, Notification, SchoolData, User } from '../types'
import { BRANCH_STAFF_ROLES, CURRENT_STUDENT_STATUSES } from '../types'
import { inAnyGroup } from './membership'

/** The branch someone works at; null for the owner (every branch). */
export function userBranchId(data: SchoolData, user: User): string | null {
  if (user.role === 'teacher') return data.teachers.find((t) => t.id === user.teacherId)?.branchId ?? null
  return user.branchId
}

export function notificationIsFor(n: Notification, user: User, branchId: string | null): boolean {
  const { role, branchId: forBranch, teacherId } = n.audience
  if (role && role !== user.role) return false
  if (forBranch && forBranch !== branchId) return false
  if (teacherId && teacherId !== user.teacherId) return false
  return true
}

export function scopeData(data: SchoolData, user: User): SchoolData {
  if (user.role === 'owner') return data
  const branchId = userBranchId(data, user)
  const notifications = data.notifications.filter((n) => notificationIsFor(n, user, branchId))

  // Administrators and accountants see their whole branch.
  if (BRANCH_STAFF_ROLES.includes(user.role)) {
    const groups = data.groups.filter((g) => g.branchId === branchId)
    const groupIds = new Set(groups.map((g) => g.id))
    const students = data.students.filter((s) => s.branchId === branchId)
    const studentIds = new Set(students.map((s) => s.id))
    const teacherIds = new Set(data.teachers.filter((t) => t.branchId === branchId).map((t) => t.id))
    return {
      ...data,
      teachers: data.teachers.filter((t) => t.branchId === branchId),
      groups,
      students,
      payments: data.payments.filter((p) => studentIds.has(p.studentId)),
      attendance: data.attendance.filter((r) => groupIds.has(r.groupId)),
      homework: data.homework.filter((h) => groupIds.has(h.groupId)),
      homeworkResults: data.homeworkResults.filter((r) => studentIds.has(r.studentId)),
      studentNotes: data.studentNotes.filter((n) => studentIds.has(n.studentId)),
      rooms: data.rooms.filter((r) => r.branchId === branchId),
      enrollments: data.enrollments.filter((e) => studentIds.has(e.studentId)),
      studentEvents: data.studentEvents.filter((e) => studentIds.has(e.studentId)),
      leads: data.leads.filter((l) => l.branchId === branchId),
      assessments: data.assessments.filter((a) => groupIds.has(a.groupId)),
      extraLessons: data.extraLessons.filter((x) => x.branchId === branchId),
      // Organisation-wide expenses (no branch) are the owner's.
      expenses: data.expenses.filter((e) => e.branchId === branchId),
      salaryPayments: data.salaryPayments.filter((p) => teacherIds.has(p.teacherId)),
      staffAttendance: data.staffAttendance.filter((r) => r.branchId === branchId),
      contactLogs: data.contactLogs.filter((l) => l.branchId === branchId),
      bonuses: data.bonuses.filter((b) => teacherIds.has(b.teacherId)),
      notifications,
      activity: data.activity.filter((a) => !a.branchId || a.branchId === branchId),
    }
  }

  // Teacher: their own groups and the students in them. No payments or tuition.
  const groups = data.groups.filter((g) => g.teacherId === user.teacherId)
  const groupIds = new Set(groups.map((g) => g.id))
  // Only students still studying: left and graduated students are the administrator's archive.
  const students = data.students.filter((s) => inAnyGroup(s, groupIds) && CURRENT_STUDENT_STATUSES.includes(s.status))
  const studentIds = new Set(students.map((s) => s.id))
  const homework = data.homework.filter((h) => groupIds.has(h.groupId))
  const homeworkIds = new Set(homework.map((h) => h.id))
  return {
    ...data,
    users: data.users.filter((u) => u.id === user.id),
    teachers: data.teachers.filter((t) => t.id === user.teacherId),
    groups,
    students,
    payments: [],
    attendance: data.attendance.filter((r) => groupIds.has(r.groupId)),
    homework,
    // Results for their own homework, for students still in their groups.
    homeworkResults: data.homeworkResults.filter((r) => homeworkIds.has(r.homeworkId) && studentIds.has(r.studentId)),
    studentNotes: data.studentNotes.filter((n) => studentIds.has(n.studentId)),
    rooms: data.rooms.filter((r) => groups.some((g) => g.branchId === r.branchId)),
    enrollments: data.enrollments.filter((e) => studentIds.has(e.studentId)),
    studentEvents: [],
    // Admissions, money going out and the front office belong to the branch staff.
    leads: [],
    assessments: data.assessments.filter((a) => groupIds.has(a.groupId)),
    extraLessons: data.extraLessons.filter((x) => x.teacherId === user.teacherId),
    expenses: [],
    salaryPayments: data.salaryPayments.filter((p) => p.teacherId === user.teacherId),
    staffAttendance: data.staffAttendance.filter((r) => r.personId === user.teacherId),
    contactLogs: [],
    bonuses: data.bonuses.filter((b) => b.teacherId === user.teacherId),
    notifications,
    activity: [],
  }
}

/** Whether this person may take attendance and set homework for the group. */
export function canTeachGroup(user: User, group: Group | undefined, data: SchoolData): boolean {
  if (!group) return false
  if (user.role === 'owner') return true
  if (BRANCH_STAFF_ROLES.includes(user.role)) return group.branchId === user.branchId
  return group.teacherId === user.teacherId && userBranchId(data, user) !== null
}
