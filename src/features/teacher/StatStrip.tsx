import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface Stat {
  to: string
  icon: LucideIcon
  label: string
  value: ReactNode
  detail: ReactNode
  tone?: 'default' | 'warning'
}

/** Headline numbers in one ruled strip, matching the administrator dashboard. */
export function StatStrip({ stats, label }: { stats: Stat[]; label: string }) {
  return (
    <section aria-label={label} className="grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ to, icon: Icon, label: name, value, detail, tone = 'default' }) => (
        <Link key={name} to={to} className="flex min-w-0 flex-col gap-1 bg-surface px-5 py-4 hover:bg-canvas focus-visible:-outline-offset-2">
          <span className="flex items-center gap-2 text-sm text-ink-muted">
            <Icon aria-hidden className="size-4 text-ink-faint" />
            {name}
          </span>
          <span className={cn('num text-[1.75rem] leading-9 font-semibold tracking-[-0.02em]', tone === 'warning' ? 'text-warning' : 'text-ink')}>{value}</span>
          <span className="text-xs text-ink-muted">{detail}</span>
        </Link>
      ))}
    </section>
  )
}
