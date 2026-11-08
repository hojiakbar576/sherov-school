// The LC UP-style sidebar for administrators, accountants and the owner:
// the same sections and sub-menus as LC UP, so staff find things where they
// are used to. Entries we haven't built yet open a "coming soon" page; once
// the centre says what it really uses, remove or rename entries here.

import {
  Archive,
  Building2,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShoppingCart,
  UserRound,
  UsersRound,
  Wallet,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'
import { tr } from '../i18n'

export interface MenuNode {
  label: string
  icon?: LucideIcon
  /** Where it opens. May carry ?query or #section. Missing for folders. */
  to?: string
  /** Not built yet: opens the "coming soon" page at `to`. */
  soon?: boolean
  /** One line for the coming-soon page: what this will do. */
  about?: string
  children?: MenuNode[]
}

const soon = (label: string, to: string, about: string): MenuNode => ({ label, to, soon: true, about })

export const ADMIN_MENU: MenuNode[] = [
  { label: tr("Dashboard"), icon: LayoutDashboard, to: '/' },
  { label: tr("Leads"), icon: ListChecks, to: '/leads' },
  { label: tr("Students"), icon: GraduationCap, to: '/students' },
  { label: tr("Groups"), icon: UsersRound, to: '/groups' },
  { label: tr("Teachers"), icon: UserRound, to: '/teachers' },
  { label: tr("Timetable"), icon: CalendarDays, to: '/schedule' },
  { label: tr("Attendance"), icon: ClipboardCheck, to: '/attendance' },
  {
    label: tr("Finance"),
    icon: Wallet,
    children: [
      { label: tr("Payments"), to: '/payments?view=history' },
      soon(tr("Extra income"), '/finance/extra-income', tr("Sales of books and goods, their cost and profit.")),
      { label: tr("Salaries"), to: '/salaries' },
      { label: tr("Expenses"), to: '/expenses' },
      { label: tr("Debtors"), to: '/payments?view=owing' },
      soon(tr("Mastery and KPI"), '/finance/kpi', tr("Monthly KPI rewards for teachers and staff.")),
      soon(tr("Bonuses and fines"), '/finance/bonuses', tr("One-off bonuses and fines added to a salary.")),
    ],
  },
  {
    label: tr("Settings"),
    icon: Settings,
    children: [
      { label: tr("General settings"), to: '/settings/general' },
      { label: tr("Centre details"), to: '/settings' },
      {
        label: tr("Office"),
        children: [
          soon(tr("Positions"), '/settings/positions', tr("Job titles (Admin, Cashier, Marketer…) and what each may open.")),
          soon(tr("Staff"), '/settings/staff', tr("Office staff, their positions and monthly pay.")),
          { label: tr("Rooms"), to: '/settings#rooms' },
          { label: tr("Holidays"), to: '/settings/general?tab=holidays' },
          { label: tr("Receipt settings"), to: '/settings/general?tab=receipt' },
        ],
      },
      {
        label: tr("Learning"),
        children: [
          { label: tr("Courses"), to: '/settings#courses' },
          { label: tr("Reasons"), to: '/settings/general?tab=reasons' },
          soon(tr("Level test"), '/settings/level-test', tr("Placement tests with a link to send to new students.")),
          soon(tr("Points and coins"), '/settings/coins', tr("Grading scale and coins for grades, attendance and games.")),
          soon(tr("Exam templates"), '/settings/exam-templates', tr("Reusable exams with sections, pass mark and coins.")),
        ],
      },
      {
        label: tr("SMS"),
        children: [
          soon(tr("Auto SMS"), '/settings/sms/auto', tr("Messages sent by themselves, e.g. to debtors on the 26th.")),
          soon(tr("Templates"), '/settings/sms/templates', tr("Ready texts for SMS sent by hand.")),
          soon(tr("Chat settings"), '/settings/sms/chat', tr("Who may write to whom, and the Telegram bot link.")),
        ],
      },
      {
        label: tr("Forms"),
        children: [
          soon(tr("Lead forms"), '/settings/forms/leads', tr("Sign-up forms that create leads.")),
          soon(tr("Simple form"), '/settings/forms/simple', tr("Your own fields for new students.")),
          soon(tr("Teacher form"), '/settings/forms/teacher', tr("Extra fields when adding a teacher.")),
          soon(tr("Staff forms"), '/settings/forms/staff', tr("Extra fields when adding staff.")),
          soon(tr("Referral forms"), '/settings/forms/referral', tr("Forms for students who bring a friend.")),
        ],
      },
      { label: tr("Tags"), to: '/settings#lists' },
      { label: tr("Payment types"), to: '/settings#lists' },
      soon(tr("Integrations"), '/settings/integrations', tr("Eskiz SMS, calls and AI homework checking.")),
    ],
  },
  {
    label: tr("Reports"),
    icon: ChartColumn,
    children: [
      {
        label: tr("Financial reports"),
        children: [
          { label: tr("Course report"), to: '/reports#enrolment-report' },
          { label: tr("Teacher performance"), to: '/reports#teacher-report' },
          { label: tr("Cash flow"), to: '/reports#profit-report' },
        ],
      },
      { label: tr("Salary report"), to: '/salaries' },
      soon(tr("Lead reports"), '/reports/leads', tr("Lead funnel: how many reach each stage and where they drop off.")),
      { label: tr("Removed from groups"), to: '/reports#retention-report' },
      { label: tr("Attendance reports"), to: '/reports#attendance-report' },
      soon(tr("Points report"), '/reports/points', tr("Students who got a given grade several times.")),
      { label: tr("Exam report"), to: '/assessments' },
      soon(tr("Discount report"), '/reports/discounts', tr("Every discount, its period and whether it cut the teacher’s share.")),
      soon(tr("Sent SMS"), '/reports/sms', tr("Every SMS sent, with its status.")),
      soon(tr("Calls"), '/reports/calls', tr("Call history from the phone system.")),
      { label: tr("Working hours report"), to: '/staff-attendance' },
      { label: tr("Logs"), to: '/activity' },
      soon(tr("Coin and crystal report"), '/reports/coins', tr("Who got coins or crystals, for what and from whom.")),
    ],
  },
  { label: tr("Staff attendance"), icon: UserCheck, to: '/staff-attendance' },
  {
    label: tr("Archive"),
    icon: Archive,
    children: [
      soon(tr("Archived leads"), '/archive/leads', tr("Removed leads, with the reason. Restore with one click.")),
      soon(tr("Archived students"), '/archive/students', tr("Students who left, with balance and reason. Restore with one click.")),
      soon(tr("Archived teachers"), '/archive/teachers', tr("Teachers who left.")),
      soon(tr("Archived staff"), '/archive/staff', tr("Staff who left.")),
      soon(tr("Archived groups"), '/archive/groups', tr("Closed groups.")),
      soon(tr("Archived payments"), '/archive/payments', tr("Cancelled payments, expenses and salaries, with who cancelled them.")),
    ],
  },
  soon(tr("Market"), '/market', tr("Shop where students spend coins.")),
]
ADMIN_MENU[ADMIN_MENU.length - 1].icon = ShoppingCart

/** The owner sees the organisation first, then the same menu as an administrator. */
export const OWNER_MENU: MenuNode[] = [
  {
    label: tr("Organisation"),
    icon: Building2,
    children: [
      { label: tr("Overview"), to: '/owner' },
      { label: tr("Branches"), to: '/owner/branches' },
      { label: tr("All finances"), to: '/owner/finance' },
      { label: tr("Teacher rating"), to: '/owner/teachers' },
      { label: tr("Users and access"), to: '/owner/users' },
      { label: tr("Owner settings"), to: '/owner/settings' },
      { label: tr("Move from LC UP"), to: '/owner/import' },
    ],
  },
  ...ADMIN_MENU,
]

/** Every entry with a link, depth-first. */
export function flattenMenu(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap((n) => [...(n.to ? [n] : []), ...(n.children ? flattenMenu(n.children) : [])])
}

/** The page's path without ?query or #section. */
export const pathOf = (to: string) => to.split(/[?#]/)[0]

/** All "coming soon" pages, for the router. */
export const SOON_PAGES: MenuNode[] = flattenMenu(ADMIN_MENU).filter((n) => n.soon)

/** Keeps only entries the filter allows, and drops folders left empty. */
export function filterMenu(nodes: MenuNode[], keep: (to: string) => boolean): MenuNode[] {
  return nodes.flatMap((n) => {
    if (n.children) {
      const children = filterMenu(n.children, keep)
      return children.length ? [{ ...n, children }] : []
    }
    return n.to && keep(pathOf(n.to)) ? [n] : []
  })
}

/**
 * Is this entry the open page? Entries with ?view= or #section must match
 * those too, so "Payments" and "Debtors" are not both lit.
 */
export function isMenuActive(to: string, location: { pathname: string; search: string; hash: string }): boolean {
  const [path, rest = ''] = to.split(/(?=[?#])/)
  if (path !== location.pathname) {
    const nested = path !== '/' && path !== '/owner' && !rest && location.pathname.startsWith(`${path}/`)
    // /settings/general is its own entry, so /settings must not light up for it.
    return nested && !flattenMenu(OWNER_MENU).some((n) => n.to && pathOf(n.to) !== path && location.pathname.startsWith(pathOf(n.to)) && pathOf(n.to).startsWith(path))
  }
  if (rest.startsWith('?')) {
    const [query, hash = ''] = rest.slice(1).split('#')
    const want = new URLSearchParams(query)
    const have = new URLSearchParams(location.search)
    for (const [k, v] of want) if (have.get(k) !== v) return false
    return hash ? location.hash === `#${hash}` : true
  }
  if (rest.startsWith('#')) return location.hash === rest
  // Plain path: lit unless a sibling entry with a #section/?query for the same path is a better match.
  return !location.hash && !location.search ? true : !flattenMenu(OWNER_MENU).some((n) => n.to && n.to !== to && pathOf(n.to) === path && isMenuActive(n.to, location))
}

/** Does this folder hold the open page? Used to open it on load. */
export function containsActive(node: MenuNode, location: { pathname: string; search: string; hash: string }): boolean {
  if (node.to && isMenuActive(node.to, location)) return true
  return !!node.children?.some((c) => containsActive(c, location))
}
