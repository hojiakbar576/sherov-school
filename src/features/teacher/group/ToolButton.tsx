import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import { tr } from '../../../i18n'

/** One choice in the "pick a mark" palette (lessons and homework). */
export function ToolButton({
  active,
  onClick,
  children,
  shortcut,
  label,
  className,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  shortcut: string
  label?: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      data-active={active}
      title={tr('{0} (key {1})', label ?? '', shortcut).trim()}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium transition-colors',
        active ? 'border-transparent shadow-sm ring-2 ring-ink/80 ring-offset-2' : 'border-line-strong bg-surface text-ink hover:bg-subtle',
        className,
      )}
    >
      {children}
    </button>
  )
}
