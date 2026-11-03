import {
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  GraduationCap,
  House,
  LayoutDashboard,
  NotebookPen,
  Settings,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '../types'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export interface PortalNav {
  /** Where the portal's pages live: "" for administrators, "/teacher" for teachers. */
  base: string
  sections: NavSection[]
  /** Pinned to the bottom of the sidebar. */
  footer?: NavItem
  /** Pages reached from elsewhere (e.g. the bell), named here only for the header title. */
  hidden?: Pick<NavItem, 'to' | 'label'>[]
}

/** Administrator sidebar. Every entry here has a matching route in App.tsx. */
export const NAV_SECTIONS: NavSection[] = [
  { label: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'People',
    items: [
      { to: '/students', label: 'Students', icon: Users },
      { to: '/teachers', label: 'Teachers', icon: GraduationCap },
    ],
  },
  {
    label: 'Teaching',
    items: [
      { to: '/groups', label: 'Groups', icon: UsersRound },
      { to: '/attendance', label: 'Attendance', icon: ClipboardCheck },
      { to: '/schedule', label: 'Schedule', icon: CalendarDays },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/payments', label: 'Payments', icon: Wallet },
      { to: '/reports', label: 'Reports', icon: ChartColumn },
    ],
  },
]

export const SETTINGS_ITEM: NavItem = { to: '/settings', label: 'Settings', icon: Settings }

const ADMIN_NAV: PortalNav = { base: '', sections: NAV_SECTIONS, footer: SETTINGS_ITEM }

/**
 * Teacher sidebar, modelled on LC UP's teacher side (without chat): one short
 * list. Groups open from Home; attendance and grades are taken inside a group.
 */
const TEACHER_NAV: PortalNav = {
  base: '/teacher',
  sections: [
    {
      label: '',
      items: [
        { to: '/teacher', label: 'Home', icon: House },
        { to: '/teacher/students', label: 'Students', icon: GraduationCap },
        { to: '/teacher/statistics', label: 'Statistics', icon: ChartColumn },
        { to: '/teacher/homework', label: 'Homework', icon: NotebookPen },
        { to: '/teacher/profile', label: 'Profile', icon: UserRound },
      ],
    },
  ],
  hidden: [
    { to: '/teacher/notifications', label: 'Notifications' },
    { to: '/teacher/groups', label: 'Group' },
    { to: '/teacher/schedule', label: 'Schedule' },
  ],
}

/** The owner portal isn't built yet; the owner would see the administrator pages. */
export function navFor(role: Role): PortalNav {
  return role === 'teacher' ? TEACHER_NAV : ADMIN_NAV
}

/** Title for the header, e.g. "/students/stu_001" -> "Students". */
export function pageTitle(pathname: string, role: Role = 'admin'): string {
  const nav = navFor(role)
  const items = [...nav.sections.flatMap((s) => s.items), ...(nav.footer ? [nav.footer] : []), ...(nav.hidden ?? [])]
  const home = nav.base || '/'
  if (pathname === home || pathname === `${home}/`) return role === 'teacher' ? 'Home' : 'Dashboard'
  const match = items.find((item) => item.to !== home && pathname.startsWith(item.to))
  return match?.label ?? 'Page not found'
}
