import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ChevronDown, ChevronRight, Circle } from 'lucide-react'
import { containsActive, isMenuActive, type MenuNode } from '../../app/menu'
import { cn } from '../../lib/cn'

/**
 * LC UP-style menu: big rows with icons, folders that fold open, the open
 * page as a filled pill. Folders holding the open page start open.
 */
export function MenuTree({ nodes, collapsed = false, onNavigate, onExpand }: { nodes: MenuNode[]; collapsed?: boolean; onNavigate?: () => void; onExpand?: () => void }) {
  return (
    <ul className="space-y-1">
      {nodes.map((n) => (
        <MenuRow key={n.label + (n.to ?? '')} node={n} depth={0} collapsed={collapsed} onNavigate={onNavigate} onExpand={onExpand} />
      ))}
    </ul>
  )
}

function MenuRow({ node, depth, collapsed, onNavigate, onExpand }: { node: MenuNode; depth: number; collapsed: boolean; onNavigate?: () => void; onExpand?: () => void }) {
  const location = useLocation()
  const holdsActive = containsActive(node, location)
  const [open, setOpen] = useState(holdsActive)
  const [wasHolding, setWasHolding] = useState(holdsActive)
  // Open the folder when navigation moves into it (e.g. a link from another page).
  if (holdsActive !== wasHolding) {
    setWasHolding(holdsActive)
    if (holdsActive) setOpen(true)
  }
  const Icon = node.icon ?? Circle
  const pad = collapsed ? 'justify-center px-0' : depth === 0 ? 'px-3' : depth === 1 ? 'pl-10 pr-3' : 'pl-14 pr-3'
  const base = cn('flex w-full items-center gap-3 rounded-xl text-left transition-colors', depth === 0 ? 'h-11 text-[0.9375rem] font-medium' : 'h-9 text-sm', pad)

  if (node.children) {
    return (
      <li>
        <button
          type="button"
          aria-expanded={open}
          title={collapsed ? node.label : undefined}
          onClick={() => {
            if (collapsed) {
              onExpand?.()
              setOpen(true)
            } else setOpen((v) => !v)
          }}
          className={cn(base, holdsActive && !open ? 'text-brand' : 'text-ink-muted hover:bg-subtle hover:text-ink')}
        >
          {depth === 0 && <Icon aria-hidden className={cn('size-5 shrink-0', holdsActive && 'text-brand')} />}
          <span className={cn('flex-1', collapsed && 'sr-only', holdsActive && 'text-brand')}>{node.label}</span>
          {!collapsed && (open ? <ChevronDown aria-hidden className="size-4 shrink-0" /> : <ChevronRight aria-hidden className="size-4 shrink-0" />)}
        </button>
        {open && !collapsed && (
          <ul className={cn('mt-1 space-y-0.5', depth === 0 && 'relative before:absolute before:top-1 before:bottom-1 before:left-[1.375rem] before:w-px before:bg-line')}>
            {node.children.map((c) => (
              <MenuRow key={c.label + (c.to ?? '')} node={c} depth={depth + 1} collapsed={collapsed} onNavigate={onNavigate} onExpand={onExpand} />
            ))}
          </ul>
        )}
      </li>
    )
  }

  const active = !!node.to && isMenuActive(node.to, location)
  return (
    <li>
      <Link
        to={node.to ?? '/'}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? node.label : undefined}
        className={cn(base, active ? 'bg-brand text-white shadow-[0_6px_16px_-6px_rgb(30_107_62/0.55)]' : 'text-ink-muted hover:bg-subtle hover:text-ink')}
      >
        {depth === 0 && <Icon aria-hidden className="size-5 shrink-0" />}
        <span className={cn('flex-1 truncate', collapsed && 'sr-only')}>{node.label}</span>
        {node.soon && !collapsed && <span className={cn('rounded-full px-1.5 text-[0.625rem] font-medium', active ? 'bg-white/20' : 'bg-subtle text-ink-faint')}>•••</span>}
      </Link>
    </li>
  )
}
