// Which sections each role can open. The sidebar only shows these, and
// opening any other page sends the person back to their dashboard. This
// shapes the demo interface only: real permissions must also be checked on
// the server once the app has one.

import type { Role } from '../types'

export const SECTIONS = [
  'dashboard',
  'leads',
  'students',
  'teachers',
  'groups',
  'schedule',
  'attendance',
  'assessments',
  'payments',
  'expenses',
  'salaries',
  'staffAttendance',
  'reports',
  'activity',
  'settings',
] as const
export type Section = (typeof SECTIONS)[number]

/** Where each section lives. Detail pages (e.g. /students/stu_001) belong to their section. */
export const SECTION_PATH: Record<Section, string> = {
  dashboard: '/',
  leads: '/leads',
  students: '/students',
  teachers: '/teachers',
  groups: '/groups',
  schedule: '/schedule',
  attendance: '/attendance',
  assessments: '/assessments',
  payments: '/payments',
  expenses: '/expenses',
  salaries: '/salaries',
  staffAttendance: '/staff-attendance',
  reports: '/reports',
  activity: '/activity',
  settings: '/settings',
}

const ALL = [...SECTIONS]

/**
 * Change these lists to change what a role can do. Teachers have their own
 * portal and use none of these sections.
 */
export const ROLE_SECTIONS: Record<Role, readonly Section[]> = {
  owner: ALL,
  admin: ALL,
  // Front desk: new people, students, the timetable and taking payments.
  reception: ['dashboard', 'leads', 'students', 'groups', 'schedule', 'attendance', 'payments', 'staffAttendance'],
  // Money: payments, debts, expenses, salaries and the reports that go with them.
  accountant: ['dashboard', 'students', 'payments', 'expenses', 'salaries', 'reports', 'activity'],
  teacher: [],
}

export const roleDescription: Record<Role, string> = {
  owner: 'Everything, in every branch.',
  admin: 'Everything in one branch.',
  reception: 'Admissions, students, groups, schedule, attendance and taking payments in one branch.',
  accountant: 'Payments, debts, expenses, salaries and reports in one branch.',
  teacher: 'Their own groups, students, attendance and homework (teacher portal).',
}

export function can(role: Role, section: Section): boolean {
  return ROLE_SECTIONS[role].includes(section)
}

/** The section a path belongs to, or null for pages outside the sections (owner and teacher pages). */
export function sectionForPath(pathname: string): Section | null {
  if (pathname === '/' || pathname === '') return 'dashboard'
  let best: Section | null = null
  for (const s of SECTIONS) {
    const path = SECTION_PATH[s]
    if (path !== '/' && (pathname === path || pathname.startsWith(`${path}/`))) {
      if (!best || path.length > SECTION_PATH[best].length) best = s
    }
  }
  return best
}

/** Whether this role may open this path in the branch pages. */
export function canOpen(role: Role, pathname: string): boolean {
  const section = sectionForPath(pathname)
  return section === null || can(role, section)
}
