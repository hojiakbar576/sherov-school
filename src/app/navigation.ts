import {
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavSection {
  label: string
  items: NavItem[]
}

/** Sidebar structure. Every entry here has a matching route in App.tsx. */
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

const ALL_ITEMS = [...NAV_SECTIONS.flatMap((s) => s.items), SETTINGS_ITEM]

/** Title for the header, e.g. "/students/stu_001" -> "Students". */
export function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard'
  const match = ALL_ITEMS.find((item) => item.to !== '/' && pathname.startsWith(item.to))
  return match?.label ?? 'Page not found'
}
