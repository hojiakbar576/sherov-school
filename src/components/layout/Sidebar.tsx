import { NavLink } from 'react-router'
import { HardDrive, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { navFor, type NavItem } from '../../app/navigation'
import { useSchool } from '../../data/school-context'
import { cn } from '../../lib/cn'
import { Logo } from './Logo'

interface SidebarNavProps {
  collapsed?: boolean
  onNavigate?: () => void
}

function NavEntry({ item, collapsed, onNavigate }: { item: NavItem } & SidebarNavProps) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/' || item.to === '/teacher'}
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
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col overflow-y-auto px-3 py-2">
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
      <div className="flex justify-center pb-4" title="Demo mode: data is saved in this browser only">
        <HardDrive aria-label="Demo mode: data is saved in this browser only" className="size-4 text-sidebar-faint" />
      </div>
    )
  }
  return (
    <div className="mx-3 mb-4 rounded-control bg-sidebar-hover px-3 py-2.5 text-xs text-sidebar-muted">
      <p className="font-medium text-sidebar-ink">Demo mode</p>
      <p className="mt-0.5">Sample data and temporary demo sign-in, saved only in this browser. No server or database yet.</p>
    </div>
  )
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        'on-dark sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar lg:flex',
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
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        className={cn(
          'flex h-11 items-center gap-2 border-t border-sidebar-line text-sm text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-ink',
          collapsed ? 'justify-center' : 'px-5',
        )}
      >
        {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  )
}
