import { Link } from 'react-router'
import { CalendarX2, CircleCheck, Clock, UsersRound, Wallet, type LucideIcon } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/misc'
import { attentionLabel, attentionLink } from '../../hooks/useAttention'
import type { AttentionItem, AttentionKind } from '../../lib/metrics'

const ORDER: { kind: AttentionKind; limit: number; icon: LucideIcon; tint: string }[] = [
  { kind: 'attendance_missing', limit: 3, icon: CalendarX2, tint: 'bg-danger-soft text-danger' },
  { kind: 'overdue', limit: 3, icon: Wallet, tint: 'bg-danger-soft text-danger' },
  { kind: 'absences', limit: 3, icon: Clock, tint: 'bg-warning-soft text-warning' },
  { kind: 'capacity', limit: 2, icon: UsersRound, tint: 'bg-brand-soft text-brand-ink' },
]

const actionLabel: Record<AttentionKind, string> = {
  overdue: 'Record payment',
  absences: 'View student',
  capacity: 'View group',
  attendance_missing: 'Take attendance',
}

interface NeedsAttentionProps {
  items: AttentionItem[]
  onRecordPayment: (studentId: string) => void
}

/** A short, actionable list. Each row explains why it is here and what to do. */
export function NeedsAttention({ items, onRecordPayment }: NeedsAttentionProps) {
  const overdueCount = items.filter((i) => i.kind === 'overdue').length

  return (
    <Panel id="needs-attention" title="Needs attention" description={items.length ? 'The most important items first' : undefined} flush>
      {items.length === 0 ? (
        <EmptyState icon={CircleCheck} title="All clear">
          No overdue tuition, repeated absences, full groups or missing attendance.
        </EmptyState>
      ) : (
        <div className="divide-y divide-line border-t border-line">
          {ORDER.map(({ kind, limit, icon: Icon, tint }) => {
            const group = items.filter((i) => i.kind === kind)
            if (group.length === 0) return null
            return (
              <div key={kind} className="px-5 py-3">
                <h3 className="mb-1 flex items-center gap-2 text-xs font-medium text-ink-muted">
                  {attentionLabel[kind]}
                  <span className="num rounded-full bg-subtle px-1.5 text-ink">{group.length}</span>
                </h3>
                <ul>
                  {group.slice(0, limit).map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2">
                      <span aria-hidden className={`flex size-8 shrink-0 items-center justify-center rounded-full ${tint}`}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                        <p className="text-xs text-ink-muted">{item.reason}</p>
                      </div>
                      {kind === 'overdue' ? (
                        <Button size="sm" onClick={() => onRecordPayment(item.studentId!)}>
                          {actionLabel[kind]}
                          <span className="sr-only"> for {item.title}</span>
                        </Button>
                      ) : (
                        <Link to={attentionLink(item)} className="shrink-0 text-sm font-medium text-brand hover:underline">
                          {actionLabel[kind]}
                          <span className="sr-only">: {item.title}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
                {kind === 'overdue' && overdueCount > limit && (
                  <Link to="/students?tuition=overdue" className="mt-1 inline-block text-sm font-medium text-brand hover:underline">
                    See all {overdueCount} students with overdue tuition
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
