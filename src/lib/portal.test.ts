import { describe, expect, it } from 'vitest'
import type { SchoolData, User } from '../types'
import { createDemoData } from '../data/seed'
import { migrate } from '../data/migrate'
import { validateSchoolData } from '../data/storage'
import { DEMO_PASSWORD, demoSignIn } from './auth'
import { canTeachGroup, scopeData } from './scope'
import { teacherNotifications } from './notifications'
import { findScheduleConflicts } from './schedule'

const NOW = new Date(2026, 9, 29, 15, 45) // Thu 29 Oct 2026, 15:45
const data = createDemoData(NOW)
const userNamed = (username: string) => data.users.find((u) => u.username === username)!

describe('branches and accounts', () => {
  it('keeps every group, student and teacher in a real branch', () => {
    const branchIds = new Set(data.branches.map((b) => b.id))
    expect(data.branches.map((b) => b.name).sort()).toEqual(['Bashlik', 'Chilonzor', 'Quyliq'])
    const teacherBranch = new Map(data.teachers.map((t) => [t.id, t.branchId]))
    const groupBranch = new Map(data.groups.map((g) => [g.id, g.branchId]))
    for (const t of data.teachers) expect(branchIds.has(t.branchId)).toBe(true)
    // A group is always at its teacher's branch, and a student at their group's.
    for (const g of data.groups) expect(g.branchId).toBe(teacherBranch.get(g.teacherId))
    for (const s of data.students) {
      expect(branchIds.has(s.branchId)).toBe(true)
      if (s.groupId) expect(s.branchId).toBe(groupBranch.get(s.groupId))
    }
  })

  it('gives one administrator per branch and one account per teacher, with no passwords stored', () => {
    const admins = data.users.filter((u) => u.role === 'admin')
    expect(admins.map((u) => u.branchId).sort()).toEqual(data.branches.map((b) => b.id).sort())
    expect(data.users.filter((u) => u.role === 'teacher')).toHaveLength(data.teachers.length)
    expect(new Set(data.users.map((u) => u.username)).size).toBe(data.users.length)
    expect(JSON.stringify(data)).not.toMatch(/password/i)
    for (const u of data.users) expect(u).not.toHaveProperty('password')
  })

  it('every attendance record names a student, group, class time and date', () => {
    const groupIds = new Set(data.groups.map((g) => g.id))
    const studentIds = new Set(data.students.map((s) => s.id))
    for (const r of data.attendance) {
      expect(groupIds.has(r.groupId)).toBe(true)
      expect(r.startTime).toMatch(/^\d\d:\d\d$/)
      expect(r.teacherId).toMatch(/^tch_/)
      for (const id of Object.keys(r.marks)) expect(studentIds.has(id)).toBe(true)
    }
  })

  it('signs in only admin and teacher demo accounts with the demo password', () => {
    expect(demoSignIn(data.users, 'admin.chilonzor', DEMO_PASSWORD)?.role).toBe('admin')
    expect(demoSignIn(data.users, ' Kamola ', DEMO_PASSWORD)?.role).toBe('teacher')
    expect(demoSignIn(data.users, 'kamola', 'wrong')).toBeNull()
    expect(demoSignIn(data.users, 'owner', DEMO_PASSWORD)).toBeNull() // owner portal not built yet
  })

  it('allows the same room name at different branches', () => {
    const a = data.groups.find((g) => g.branchId === 'br_chilonzor' && g.status === 'active')!
    const elsewhere = { ...a, id: 'grp_test', teacherId: 'tch_02', branchId: 'br_bashlik' }
    expect(findScheduleConflicts(elsewhere, data.groups).room).toBeUndefined()
    expect(findScheduleConflicts({ ...elsewhere, branchId: a.branchId }, data.groups).room?.id).toBe(a.id)
  })
})

describe('what each person can see', () => {
  it('limits an administrator to their own branch', () => {
    const admin = userNamed('admin.bashlik')
    const view = scopeData(data, admin)
    expect(view.groups.length).toBeGreaterThan(0)
    expect(view.groups.every((g) => g.branchId === 'br_bashlik')).toBe(true)
    expect(view.teachers.every((t) => t.branchId === 'br_bashlik')).toBe(true)
    expect(view.students.every((s) => s.branchId === 'br_bashlik')).toBe(true)
    const studentIds = new Set(view.students.map((s) => s.id))
    expect(view.payments.every((p) => studentIds.has(p.studentId))).toBe(true)
    // The three branches together account for everyone.
    const total = ['admin.bashlik', 'admin.chilonzor', 'admin.quyliq'].reduce((n, u) => n + scopeData(data, userNamed(u)).students.length, 0)
    expect(total).toBe(data.students.length)
  })

  it('limits a teacher to their own groups and students, with no payments', () => {
    const teacher = userNamed('kamola')
    const view = scopeData(data, teacher)
    const groupIds = new Set(view.groups.map((g) => g.id))
    expect(view.groups.length).toBeGreaterThan(0)
    expect(view.groups.every((g) => g.teacherId === teacher.teacherId)).toBe(true)
    expect(view.students.every((s) => s.groupId !== null && groupIds.has(s.groupId))).toBe(true)
    expect(view.attendance.every((r) => groupIds.has(r.groupId))).toBe(true)
    expect(view.homework.every((h) => groupIds.has(h.groupId))).toBe(true)
    expect(view.payments).toHaveLength(0)
    expect(view.teachers).toEqual([data.teachers.find((t) => t.id === teacher.teacherId)])
  })

  it('lets a teacher take attendance only for groups they teach', () => {
    const teacher = userNamed('kamola')
    const own = data.groups.find((g) => g.teacherId === teacher.teacherId)
    const other = data.groups.find((g) => g.teacherId !== teacher.teacherId)
    expect(canTeachGroup(teacher, own, data)).toBe(true)
    expect(canTeachGroup(teacher, other, data)).toBe(false)
    const admin = userNamed('admin.chilonzor')
    expect(canTeachGroup(admin, data.groups.find((g) => g.branchId === 'br_chilonzor'), data)).toBe(true)
    expect(canTeachGroup(admin, data.groups.find((g) => g.branchId === 'br_quyliq'), data)).toBe(false)
  })

  it('shows a teacher only notifications meant for them', () => {
    const kamola = userNamed('kamola')
    const items = teacherNotifications(scopeData(data, kamola), NOW)
    const ids = items.map((n) => n.id)
    expect(ids).toContain('ntf_meeting')
    expect(ids).toContain(`ntf_room_${kamola.teacherId}`)
    expect(ids).toContain('ntf_branch_br_chilonzor')
    expect(ids).not.toContain('ntf_branch_br_quyliq')
    expect(ids.some((id) => id.startsWith('ntf_room_') && id !== `ntf_room_${kamola.teacherId}`)).toBe(false)
  })
})

describe('upgrading saved data', () => {
  /** What version 1 of the app saved: no branches, users, homework or comments. */
  function asVersion1(d: SchoolData) {
    const strip = <T extends object>(items: T[], ...keys: string[]) =>
      items.map((item) => Object.fromEntries(Object.entries(item).filter(([k]) => !keys.includes(k))))
    return JSON.parse(
      JSON.stringify({
        version: 1,
        seededAt: d.seededAt,
        teachers: strip(d.teachers, 'branchId'),
        groups: strip(d.groups, 'branchId'),
        students: strip(d.students, 'branchId'),
        attendance: strip(d.attendance, 'startTime', 'teacherId', 'comments'),
        payments: d.payments,
        activity: strip(d.activity, 'branchId'),
        settings: { ...d.settings, centerName: 'Renamed locally' },
        readNotificationIds: ['missing:grp_01:2026-10-28'],
      }),
    ) as Record<string, unknown>
  }

  it('keeps every record and local change, and passes validation', () => {
    const upgraded = migrate(asVersion1(data), 2, NOW) as unknown as SchoolData
    expect(validateSchoolData(upgraded)).toBeNull()
    expect(upgraded.students).toHaveLength(data.students.length)
    expect(upgraded.payments).toHaveLength(data.payments.length)
    expect(upgraded.attendance).toHaveLength(data.attendance.length)
    expect(upgraded.settings.centerName).toBe('Renamed locally')
    expect(upgraded.groups.map((g) => g.branchId)).toEqual(data.groups.map((g) => g.branchId))
    expect(upgraded.attendance[0].startTime).toBe(data.groups.find((g) => g.id === upgraded.attendance[0].groupId)!.startTime)
    const admin = upgraded.users.find((u: User) => u.username === 'admin.chilonzor')!
    expect(upgraded.notificationReads[admin.id]).toEqual(['missing:grp_01:2026-10-28'])
    expect(upgraded).not.toHaveProperty('readNotificationIds')
  })

  it('refuses data from a version it does not know', () => {
    expect(migrate({ version: 99 }, 2, NOW)).toBeNull()
  })
})
