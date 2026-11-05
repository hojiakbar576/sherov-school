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
  Building2,
  MapPin,
  Landmark,
  Trophy,
  Receipt,
  HandCoins,
  UserCheck,
  History,
  KeyRound,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '../types'
import { t } from '../i18n'
import { canOpen } from './permissions'
import { tr } from '../i18n'

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
      { to: '/expenses', label: t('nav.expenses'), icon: Receipt },
      { to: '/salaries', label: t('nav.salaries'), icon: HandCoins },
      { to: '/reports', label: t('nav.reports'), icon: ChartColumn },
    ],
  },
  {
    label: t('nav.office'),
    items: [
      { to: '/staff-attendance', label: t('nav.staffAttendance'), icon: UserCheck },
      { to: '/activity', label: t('nav.activity'), icon: History },
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
        { to: '/teacher', label: tr("Home"), icon: House },
        { to: '/teacher/students', label: tr("Students"), icon: GraduationCap },
        { to: '/teacher/statistics', label: tr("Statistics"), icon: ChartColumn },
        { to: '/teacher/homework', label: tr("Homework"), icon: NotebookPen },
        { to: '/teacher/profile', label: tr("Profile"), icon: UserRound },
      ],
    },
  ],
  hidden: [
    { to: '/teacher/notifications', label: tr("Notifications") },
    { to: '/teacher/groups', label: tr("Group") },
    { to: '/teacher/schedule', label: tr("Schedule") },
  ],
}

/**
 * Owner sidebar: the organisation first, then every administrator page for
 * branch work. A switcher in the header narrows those pages to one branch.
 */
const OWNER_NAV: PortalNav = {
  base: '',
  sections: [
    {
      label: t('nav.organisation'),
      items: [
        { to: '/owner', label: t('nav.ownerOverview'), icon: Building2 },
        { to: '/owner/branches', label: t('nav.branches'), icon: MapPin },
        { to: '/owner/finance', label: t('nav.finance'), icon: Landmark },
        { to: '/owner/teachers', label: t('nav.teacherRating'), icon: Trophy },
        { to: '/owner/users', label: t('nav.users'), icon: KeyRound },
      ],
    },
    {
      label: t('nav.branchWork'),
      items: [
        { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
        { to: '/leads', label: t('nav.leads'), icon: UserRoundPlus },
        { to: '/students', label: t('nav.students'), icon: Users },
        { to: '/teachers', label: t('nav.teachers'), icon: GraduationCap },
        { to: '/groups', label: t('nav.groups'), icon: UsersRound },
        { to: '/schedule', label: t('nav.schedule'), icon: CalendarDays },
        { to: '/attendance', label: t('nav.attendance'), icon: ClipboardCheck },
        { to: '/assessments', label: t('nav.assessments'), icon: ClipboardList },
        { to: '/payments', label: t('nav.payments'), icon: Wallet },
        { to: '/expenses', label: t('nav.expenses'), icon: Receipt },
        { to: '/salaries', label: t('nav.salaries'), icon: HandCoins },
        { to: '/reports', label: t('nav.reports'), icon: ChartColumn },
        { to: '/staff-attendance', label: t('nav.staffAttendance'), icon: UserCheck },
        { to: '/activity', label: t('nav.activity'), icon: History },
      ],
    },
  ],
  footer: { to: '/owner/settings', label: t('nav.ownerSettings'), icon: Settings },
  hidden: [{ to: '/settings', label: t('nav.settings') }],
}

/** Keeps only the links this role may open. */
function forRole(nav: PortalNav, role: Role): PortalNav {
  const keep = (item: NavItem) => canOpen(role, item.to)
  return {
    ...nav,
    sections: nav.sections.map((s) => ({ ...s, items: s.items.filter(keep) })).filter((s) => s.items.length > 0),
    footer: nav.footer && keep(nav.footer) ? nav.footer : undefined,
  }
}

export function navFor(role: Role): PortalNav {
  if (role === 'teacher') return TEACHER_NAV
  if (role === 'owner') return OWNER_NAV
  return role === 'admin' ? ADMIN_NAV : forRole(ADMIN_NAV, role)
}

/** Title for the header, e.g. "/students/stu_001" -> "Students". */
export function pageTitle(pathname: string, role: Role = 'admin'): string {
  const nav = navFor(role)
  const items = [...nav.sections.flatMap((s) => s.items), ...(nav.footer ? [nav.footer] : []), ...(nav.hidden ?? [])]
  const home = nav.base || '/'
  if (pathname === home || pathname === `${home}/`) return role === 'teacher' ? tr("Home") : tr("Dashboard")
  const match = items
    .filter((item) => item.to !== home && (pathname === item.to || pathname.startsWith(`${item.to}/`)))
    .sort((a, b) => b.to.length - a.to.length)[0]
  return match?.label ?? 'Page not found'
}
