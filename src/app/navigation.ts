import {
  Bell,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  NotebookPen,
  Settings,
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

const TEACHER_NAV: PortalNav = {
  base: '/teacher',
  sections: [
    { label: 'Overview', items: [{ to: '/teacher', label: 'Dashboard', icon: LayoutDashboard }] },
    {
      label: 'Teaching',
      items: [
        { to: '/teacher/schedule', label: 'My schedule', icon: CalendarDays },
        { to: '/teacher/groups', label: 'My groups', icon: UsersRound },
        { to: '/teacher/attendance', label: 'Attendance', icon: ClipboardCheck },
        { to: '/teacher/homework', label: 'Homework', icon: NotebookPen },
      ],
    },
    {
      label: 'People',
      items: [
        { to: '/teacher/students', label: 'My students', icon: Users },
        { to: '/teacher/notifications', label: 'Notifications', icon: Bell },
      ],
    },
  ],
}

/** The owner portal isn't built yet; the owner would see the administrator pages. */
export function navFor(role: Role): PortalNav {
  return role === 'teacher' ? TEACHER_NAV : ADMIN_NAV
}

/** Title for the header, e.g. "/students/stu_001" -> "Students". */
export function pageTitle(pathname: string, role: Role = 'admin'): string {
  const nav = navFor(role)
  const items = [...nav.sections.flatMap((s) => s.items), ...(nav.footer ? [nav.footer] : [])]
  const home = nav.base || '/'
  if (pathname === home || pathname === `${home}/`) return 'Dashboard'
  const match = items.find((item) => item.to !== home && pathname.startsWith(item.to))
  return match?.label ?? 'Page not found'
}
