// Sample organisation data: branches, sign-in accounts and notifications. Kept apart from seed.ts so both the generator and the
// upgrade of older saved data (migrate.ts) can use it.

import type { Branch, Group, Notification, Teacher, User } from '../types'
import { addDays, atTime, toISODate } from '../lib/dates'
import { dayPatternLabel, formatDate } from '../lib/format'

export const BRANCHES: Branch[] = [
  { id: 'br_bashlik', name: 'Bashlik', address: 'Bashlik, Tashkent', phone: '+998 71 200 00 01' },
  { id: 'br_chilonzor', name: 'Chilonzor', address: 'Chilonzor district, Tashkent', phone: '+998 71 200 00 02' },
  { id: 'br_quyliq', name: 'Quyliq', address: 'Quyliq, Tashkent', phone: '+998 71 200 00 03' },
]

/** Used when a record's branch can't be worked out (e.g. older saved data). */
export const DEFAULT_BRANCH_ID = 'br_chilonzor'

/** Where each sample teacher works. Their groups and students follow them. */
export const TEACHER_BRANCH: Record<string, string> = {
  tch_01: 'br_chilonzor',
  tch_03: 'br_chilonzor',
  tch_05: 'br_chilonzor',
  tch_10: 'br_chilonzor',
  tch_02: 'br_bashlik',
  tch_04: 'br_bashlik',
  tch_07: 'br_bashlik',
  tch_06: 'br_quyliq',
  tch_08: 'br_quyliq',
  tch_09: 'br_quyliq',
}

export const OWNER_USER: User = { id: 'usr_owner', role: 'owner', fullName: 'Sherzod', username: 'owner', branchId: null }

export const ADMIN_USERS: User[] = [
  { id: 'usr_admin_bashlik', role: 'admin', fullName: 'Gulnora Aliyeva', username: 'admin.bashlik', branchId: 'br_bashlik' },
  { id: 'usr_admin_chilonzor', role: 'admin', fullName: 'Rustam Abdullayev', username: 'admin.chilonzor', branchId: 'br_chilonzor' },
  { id: 'usr_admin_quyliq', role: 'admin', fullName: 'Malika Yusupova', username: 'admin.quyliq', branchId: 'br_quyliq' },
]

/** A teacher's sign-in account; the username is their first name ("kamola"). */
export function teacherUser(teacher: Teacher, existing: User[]): User {
  const taken = new Set(existing.map((u) => u.username))
  const base = teacher.fullName.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') || 'teacher'
  let username = base
  for (let n = 2; taken.has(username); n++) username = `${base}${n}`
  return { id: `usr_${teacher.id}`, role: 'teacher', fullName: teacher.fullName, username, branchId: null, teacherId: teacher.id }
}

export function buildUsers(teachers: Teacher[]): User[] {
  const users: User[] = [OWNER_USER, ...ADMIN_USERS].map((u) => ({ ...u }))
  for (const t of teachers) users.push(teacherUser(t, users))
  return users
}

// ---------------------------------------------------------------- notifications

const BRANCH_NOTICES: Record<string, [string, string]> = {
  br_chilonzor: ['Projector in Room 203 is being repaired', 'Use the portable screen from the front office until Friday.'],
  br_bashlik: ['Water off on Monday morning', 'Building management will turn off the water from 09:00 to 11:00 on Monday.'],
  br_quyliq: ['New whiteboards in Room 103 and Room 204', 'Please use only the new markers from the blue box on these boards.'],
}

/** Stored demo messages from the administration to teachers. */
export function seedNotifications(teachers: Teacher[], groups: Group[], now: Date): Notification[] {
  const daysAgo = (n: number, time: string) => atTime(toISODate(addDays(now, -n)), time).toISOString()
  const items: Notification[] = [
    {
      id: 'ntf_meeting',
      kind: 'announcement',
      title: 'Teachers’ meeting on Saturday',
      body: 'All teachers meet at 13:00 at the Chilonzor branch, Room 201. Agenda: mid-term progress and the winter timetable.',
      createdAt: daysAgo(1, '09:15'),
      audience: { role: 'teacher' },
    },
    {
      id: 'ntf_progress',
      kind: 'admin',
      title: 'Mid-term progress notes due',
      body: `Please send a short progress note for each of your groups to your branch administrator by ${formatDate(toISODate(addDays(now, 7)))}.`,
      createdAt: daysAgo(3, '11:40'),
      audience: { role: 'teacher' },
    },
  ]
  for (const [branchId, [title, body]] of Object.entries(BRANCH_NOTICES)) {
    items.push({ id: `ntf_branch_${branchId}`, kind: 'announcement', title, body, createdAt: daysAgo(2, '16:05'), audience: { role: 'teacher', branchId } })
  }
  // A confirmed room for each teacher's first group. It matches the current timetable.
  for (const t of teachers) {
    const group = groups.find((g) => g.teacherId === t.id && g.status === 'active')
    if (!group) continue
    items.push({
      id: `ntf_room_${t.id}`,
      kind: 'schedule',
      title: `Room confirmed for ${group.name}`,
      body: `${group.name} meets in ${group.room} at ${group.startTime} on ${dayPatternLabel[group.days]}.`,
      createdAt: daysAgo(6, '10:00'),
      audience: { teacherId: t.id },
      link: '/teacher/schedule',
    })
  }
  return items
}
