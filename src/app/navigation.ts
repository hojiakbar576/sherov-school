import {
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  House,
  LayoutDashboard,
  NotebookPen,
  Settings,
  UserRound,
  UserRoundPlus,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '../types'
import { t } from '../i18n'

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

/**
 * Administrator sidebar, in the order of a working day: what's on today,
 * new people coming in, the people you look after, teaching, then money.
 * Every entry has a matching route in App.tsx. Labels come from i18n.
 */
export const NAV_SECTIONS: NavSection[] = [
  { label: t('nav.overview'), items: [{ to: '/', label: t('nav.dashboard'), icon: LayoutDashboard }] },
  { label: t('nav.admissions'), items: [{ to: '/leads', label: t('nav.leads'), icon: UserRoundPlus }] },
  {
    label: t('nav.people'),
    items: [
      { to: '/students', label: t('nav.students'), icon: Users },
      { to: '/teachers', label: t('nav.teachers'), icon: GraduationCap },
    ],
  },
  {
    label: t('nav.teaching'),
    items: [
      { to: '/groups', label: t('nav.groups'), icon: UsersRound },
      { to: '/schedule', label: t('nav.schedule'), icon: CalendarDays },
      { to: '/attendance', label: t('nav.attendance'), icon: ClipboardCheck },
      { to: '/assessments', label: t('nav.assessments'), icon: ClipboardList },
    ],
  },
  {
    label: t('nav.finance'),
    items: [
      { to: '/payments', label: t('nav.payments'), icon: Wallet },
      { to: '/reports', label: t('nav.reports'), icon: ChartColumn },
    ],
  },
]

export const SETTINGS_ITEM: NavItem = { to: '/settings', label: t('nav.settings'), icon: Settings }

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
