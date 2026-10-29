import { NavLink } from 'react-router'
import { HardDrive, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NAV_SECTIONS, SETTINGS_ITEM, type NavItem } from '../../app/navigation'
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
      end={item.to === '/'}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-3 rounded-control px-2.5 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive ? 'bg-accent-soft text-accent-ink' : 'text-ink-muted hover:bg-subtle hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span aria-hidden className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-accent" />}
          <Icon aria-hidden className={cn('size-[18px] shrink-0', isActive ? 'text-accent' : 'text-ink-faint group-hover:text-ink-muted')} />
          <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

/** Navigation list shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col overflow-y-auto px-3 py-2">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-4">
          <p className={cn('mb-1 px-2.5 text-xs font-medium text-ink-faint', collapsed && 'sr-only')}>{section.label}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavEntry item={item} collapsed={collapsed} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="mt-auto border-t border-line pt-3">
        <NavEntry item={SETTINGS_ITEM} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </nav>
  )
}

/** Small honest reminder that everything lives in this browser only. */
export function DemoDataNote({ collapsed }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="flex justify-center pb-4" title="Demo mode: data is saved in this browser only">
        <HardDrive aria-label="Demo mode: data is saved in this browser only" className="size-4 text-ink-faint" />
      </div>
    )
  }
  return (
    <div className="mx-3 mb-4 rounded-control bg-subtle px-3 py-2.5 text-xs text-ink-muted">
      <p className="font-medium text-ink">Demo mode</p>
      <p className="mt-0.5">Sample data, saved only in this browser. No server or database yet.</p>
    </div>
  )
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface lg:flex',
        collapsed ? 'w-[72px]' : 'w-60',
      )}
    >
      <div className={cn('flex h-16 items-center', collapsed ? 'justify-center' : 'px-5')}>
        <Logo compact={collapsed} />
      </div>
      <SidebarNav collapsed={collapsed} />
      <DemoDataNote collapsed={collapsed} />
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        className={cn(
          'flex h-11 items-center gap-2 border-t border-line text-sm text-ink-muted hover:bg-subtle hover:text-ink',
          collapsed ? 'justify-center' : 'px-5',
        )}
      >
        {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  )
}
