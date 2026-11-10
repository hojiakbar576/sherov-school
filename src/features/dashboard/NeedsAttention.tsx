import { Link } from 'react-router'
import { ChevronRight, CircleCheck } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { EmptyState } from '../../components/ui/misc'
import type { AttentionRow } from './attention-rows'
import { cn } from '../../lib/cn'
import { tr } from '../../i18n'

/** A short, calm list of what needs doing now. */
export function NeedsAttention({ rows, className }: { rows: AttentionRow[]; className?: string }) {
  return (
    <Panel id="needs-attention" title={tr("Needs attention")} className={className} flush>
      {rows.length === 0 ? (
        <EmptyState icon={CircleCheck} title={tr("All clear")}>
          {tr("No missed attendance, overdue tuition or waiting enquiries right now.")}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {rows.map(({ key, icon: Icon, tint, label, detail, count, to }) => (
            <li key={key}>
              <Link to={to} className="flex items-center gap-3 px-5 py-3.5 hover:bg-canvas focus-visible:-outline-offset-2">
                <span aria-hidden className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', tint)}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{label}</span>
                  <span className="block truncate text-xs text-ink-muted">{detail}</span>
                </span>
                <span className="num text-lg font-semibold text-ink">{count}</span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
