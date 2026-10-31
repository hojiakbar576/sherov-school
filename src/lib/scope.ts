// What each signed-in person is allowed to see. Pages read the scoped data,
// so an administrator only ever counts their own branch and a teacher only
// their own groups. When a real backend arrives, the same rules move to
// the server's queries.

import type { Group, Notification, SchoolData, User } from '../types'

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

  if (user.role === 'admin') {
    const groups = data.groups.filter((g) => g.branchId === branchId)
    const groupIds = new Set(groups.map((g) => g.id))
    const students = data.students.filter((s) => s.branchId === branchId)
    const studentIds = new Set(students.map((s) => s.id))
    return {
      ...data,
      teachers: data.teachers.filter((t) => t.branchId === branchId),
      groups,
      students,
      payments: data.payments.filter((p) => studentIds.has(p.studentId)),
      attendance: data.attendance.filter((r) => groupIds.has(r.groupId)),
      homework: data.homework.filter((h) => groupIds.has(h.groupId)),
      notifications,
      activity: data.activity.filter((a) => !a.branchId || a.branchId === branchId),
    }
  }

  // Teacher: their own groups and the students in them. No payments or tuition.
  const groups = data.groups.filter((g) => g.teacherId === user.teacherId)
  const groupIds = new Set(groups.map((g) => g.id))
  return {
    ...data,
    users: data.users.filter((u) => u.id === user.id),
    teachers: data.teachers.filter((t) => t.id === user.teacherId),
    groups,
    students: data.students.filter((s) => s.groupId !== null && groupIds.has(s.groupId) && s.status !== 'left'),
    payments: [],
    attendance: data.attendance.filter((r) => groupIds.has(r.groupId)),
    homework: data.homework.filter((h) => groupIds.has(h.groupId)),
    notifications,
    activity: [],
  }
}

/** Whether this person may take attendance and set homework for the group. */
export function canTeachGroup(user: User, group: Group | undefined, data: SchoolData): boolean {
  if (!group) return false
  if (user.role === 'owner') return true
  if (user.role === 'admin') return group.branchId === user.branchId
  return group.teacherId === user.teacherId && userBranchId(data, user) !== null
}
