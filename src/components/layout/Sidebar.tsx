import { NavLink } from 'react-router'
import { HardDrive, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { navFor, type NavItem } from '../../app/navigation'
import { menuFor } from '../../app/navigation'
import { MenuTree } from './MenuTree'
import { useSchool } from '../../data/school-context'
import { cn } from '../../lib/cn'
import { Logo } from './Logo'
import { tr } from '../../i18n'

interface SidebarNavProps {
  collapsed?: boolean
  onNavigate?: () => void
}

/** Teachers get the light, LC UP-style sidebar: white card, green pill for the open page. */
function LightNavEntry({ item, onNavigate }: { item: NavItem } & SidebarNavProps) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/teacher'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex h-12 items-center gap-3 rounded-xl px-4 text-[0.9375rem] font-medium transition-colors',
          isActive ? 'bg-brand text-white shadow-[0_6px_16px_-6px_rgb(30_107_62/0.55)]' : 'text-ink-muted hover:bg-subtle hover:text-ink',
        )
      }
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  )
}

/** Navigation list shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ collapsed = false, onNavigate, onExpand }: SidebarNavProps & { onExpand?: () => void }) {
  const { user } = useSchool()
  const nav = navFor(user?.role ?? 'admin')
  if (user?.role === 'teacher') {
    return (
      <nav aria-label={tr("Main")} className="flex flex-1 flex-col overflow-y-auto px-4 py-3">
        <ul className="space-y-1.5">
          {nav.sections.flatMap((section) => section.items).map((item) => (
            <li key={item.to}>
              <LightNavEntry item={item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>
    )
  }
  return (
    <nav aria-label={tr("Main")} className={cn('flex flex-1 flex-col overflow-y-auto py-2', collapsed ? 'px-2' : 'px-3')}>
      <MenuTree nodes={menuFor(user?.role ?? 'admin')} collapsed={collapsed} onNavigate={onNavigate} onExpand={onExpand} />
    </nav>
  )
}

/** Small honest reminder that everything lives in this browser only. */
export function DemoDataNote({ collapsed }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="flex justify-center pb-4" title={tr("Sample data: saved in this browser only")}>
        <HardDrive aria-label={tr("Sample data: saved in this browser only")} className="size-4 text-sidebar-faint" />
      </div>
    )
  }
  return (
    <div className="mx-3 mb-4 rounded-control bg-sidebar-hover px-3 py-2.5 text-xs text-sidebar-muted">
      <p className="font-medium text-sidebar-ink">{tr("Sample data")}</p>
      <p className="mt-0.5">{tr("Sign-in is real. The school data is still sample data saved in this browser until it moves to the database.")}</p>
    </div>
  )
}

/** The teacher's sidebar: a light rounded card beside the page. */
export function TeacherSidebar() {
  return (
    <aside className="sticky top-0 hidden print:hidden h-dvh w-64 shrink-0 p-3 pr-0 lg:block">
      <div className="flex h-full flex-col rounded-2xl border border-line bg-surface">
        <div className="flex h-16 items-center px-6">
          <Logo />
        </div>
        <SidebarNav />
        <p className="mx-4 mb-4 rounded-xl bg-canvas px-3 py-2.5 text-xs text-ink-muted">{tr("Demo: data is saved in this browser only.")}</p>
      </div>
    </aside>
  )
}

/** Administrator, accountant and owner sidebar: light like LC UP, with the school's big logo on top. */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className={cn('sticky top-0 hidden print:hidden h-dvh shrink-0 p-3 pr-0 lg:block', collapsed ? 'w-[84px]' : 'w-72')}>
      <div className="flex h-full flex-col rounded-2xl border border-line bg-surface">
        <div className={cn('flex h-24 shrink-0 items-center border-b border-line', collapsed ? 'justify-center' : 'px-5')}>
          <Logo compact={collapsed} large={!collapsed} />
        </div>
        <SidebarNav collapsed={collapsed} onExpand={onToggle} />
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? tr("Expand sidebar") : tr("Collapse sidebar")}
          aria-expanded={!collapsed}
          className={cn('flex h-11 shrink-0 items-center gap-2 rounded-b-2xl border-t border-line text-sm text-ink-muted hover:bg-subtle hover:text-ink', collapsed ? 'justify-center' : 'px-5')}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {!collapsed && <span>{tr("Collapse")}</span>}
        </button>
      </div>
    </aside>
  )
}
