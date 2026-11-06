import { NavLink } from 'react-router'
import { HardDrive, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { navFor, type NavItem } from '../../app/navigation'
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

function NavEntry({ item, collapsed, onNavigate }: { item: NavItem } & SidebarNavProps) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/' || item.to === '/teacher' || item.to === '/owner'}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-3 rounded-control px-2.5 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span aria-hidden className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-accent" />}
          <Icon aria-hidden className={cn('size-[18px] shrink-0', isActive ? 'text-ivory' : 'text-sidebar-faint group-hover:text-sidebar-muted')} />
          <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

/** Navigation list shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
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
    <nav aria-label={tr("Main")} className="flex flex-1 flex-col overflow-y-auto px-3 py-2">
      {nav.sections.map((section) => (
        <div key={section.label} className="mb-4">
          <p className={cn('mb-1 px-2.5 text-xs font-medium tracking-[0.04em] text-sidebar-faint uppercase', collapsed && 'sr-only')}>{section.label}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavEntry item={item} collapsed={collapsed} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {nav.footer && (
        <div className="mt-auto border-t border-sidebar-line pt-3">
          <NavEntry item={nav.footer} collapsed={collapsed} onNavigate={onNavigate} />
        </div>
      )}
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

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        'on-dark sticky top-0 hidden print:hidden h-dvh shrink-0 flex-col bg-sidebar lg:flex',
        collapsed ? 'w-[72px]' : 'w-60',
      )}
    >
      <div className={cn('flex h-16 items-center', collapsed ? 'justify-center' : 'px-5')}>
        <Logo compact={collapsed} onDark />
      </div>
      <SidebarNav collapsed={collapsed} />
      <DemoDataNote collapsed={collapsed} />
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? tr("Expand sidebar") : tr("Collapse sidebar")}
        aria-expanded={!collapsed}
        className={cn(
          'flex h-11 items-center gap-2 border-t border-sidebar-line text-sm text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-ink',
          collapsed ? 'justify-center' : 'px-5',
        )}
      >
        {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
        {!collapsed && <span>{tr("Collapse")}</span>}
      </button>
    </aside>
  )
}
