import { Link } from 'react-router'
import { CalendarX2, ChevronRight, CircleCheck, Clock, NotebookPen, PhoneCall, UserRoundPlus, UserRoundX, UsersRound, Wallet, type LucideIcon } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/misc'
import { attentionLink } from '../../hooks/useAttention'
import { formatUZSCompact } from '../../lib/format'
import type { AttentionItem, AttentionKind, TuitionBalance } from '../../lib/metrics'
import { buttonClasses } from '../../components/ui/button-styles'
import { cn } from '../../lib/cn'

interface TaskKind {
  kind: AttentionKind
  icon: LucideIcon
  tint: string
  /** "4 classes need attendance" */
  title: (n: number) => string
  hint: string
  action: string
  /** Where the main button goes; per-item links are in the expanded list. */
  to: (items: AttentionItem[]) => string
}

// Most urgent first. Each row says what's wrong and what to do about it.
const TASKS: TaskKind[] = [
  {
    kind: 'trial_today',
    icon: UserRoundPlus,
    tint: 'bg-info-soft text-info',
    title: (n) => `${n} trial ${n === 1 ? 'lesson' : 'lessons'} today`,
    hint: 'Prospective students coming to sit in on a class. Greet them and record the result after.',
    action: 'Open trials',
    to: () => '/leads?stage=trial_scheduled',
  },
  {
    kind: 'attendance_missing',
    icon: CalendarX2,
    tint: 'bg-danger-soft text-danger',
    title: (n) => `${n} ${n === 1 ? 'class needs' : 'classes need'} attendance`,
    hint: 'Classes from the last 7 days that ended without attendance.',
    action: 'Review attendance',
    to: (items) => attentionLink(items[items.length - 1]),
  },
  {
    kind: 'overdue',
    icon: Wallet,
    tint: 'bg-danger-soft text-danger',
    title: (n) => `${n} ${n === 1 ? 'student has' : 'students have'} overdue tuition`,
    hint: 'Unpaid after the due day. Call the parents or record the payment.',
    action: 'View who hasn’t paid',
    to: () => '/payments?view=owing',
  },
  {
    kind: 'trial_result',
    icon: NotebookPen,
    tint: 'bg-warning-soft text-warning',
    title: (n) => `${n} trial ${n === 1 ? 'result is' : 'results are'} missing`,
    hint: 'The trial happened but nobody recorded how it went or which group fits.',
    action: 'Record results',
    to: () => '/leads?stage=trial_scheduled',
  },
  {
    kind: 'lead_new',
    icon: PhoneCall,
    tint: 'bg-accent-soft text-accent-ink',
    title: (n) => `${n} new ${n === 1 ? 'enquiry needs' : 'enquiries need'} a call back`,
    hint: 'People who asked about classes. Call them and offer a trial lesson.',
    action: 'Open admissions',
    to: () => '/leads?stage=new',
  },
  {
    kind: 'teacher_away',
    icon: UserRoundX,
    tint: 'bg-warning-soft text-warning',
    title: (n) => `${n} ${n === 1 ? 'group has' : 'groups have'} no available teacher`,
    hint: 'The teacher is on leave or missing. Assign someone or pause the group.',
    action: 'Open groups',
    to: () => '/groups',
  },
  {
    kind: 'absences',
    icon: Clock,
    tint: 'bg-warning-soft text-warning',
    title: (n) => `${n} ${n === 1 ? 'student has' : 'students have'} missed 3+ classes`,
    hint: 'In the last 14 days. Worth a call to the parents.',
    action: 'See students',
    to: (items) => attentionLink(items[0]),
  },
  {
    kind: 'capacity',
    icon: UsersRound,
    tint: 'bg-brand-soft text-brand-ink',
    title: (n) => `${n} ${n === 1 ? 'group is' : 'groups are'} full or almost full`,
    hint: 'Plan a new group before turning students away.',
    action: 'Open groups',
    to: () => '/groups',
  },
]

const PREVIEW = 8

interface Props {
  items: AttentionItem[]
  balances: Map<string, TuitionBalance>
  onRecordPayment: (studentId: string) => void
}

/**
 * What the administrator should do today: one row per kind of problem with a
 * count and a clear action. Open a row to see who or which class it is.
 */
export function TodayTasks({ items, balances, onRecordPayment }: Props) {
  const rows = TASKS.map((task) => ({ task, list: items.filter((i) => i.kind === task.kind) })).filter((r) => r.list.length > 0)

  return (
    <Panel id="today-tasks" title="Today’s tasks" description={rows.length ? 'Open a row to see the details.' : undefined} flush>
      {rows.length === 0 ? (
        <EmptyState icon={CircleCheck} title="All clear">
          No missing attendance, overdue tuition, repeated absences or groups without a teacher.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {rows.map(({ task, list }) => {
            const Icon = task.icon
            const owed = task.kind === 'overdue' ? list.reduce((sum, i) => sum + (balances.get(i.studentId!)?.owed ?? 0), 0) : 0
            return (
              <li key={task.kind}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-canvas [&::-webkit-details-marker]:hidden">
                    <span aria-hidden className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', task.tint)}>
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">
                        {task.title(list.length)}
                        {owed > 0 && <span className="num font-normal text-ink-muted"> · {formatUZSCompact(owed)}</span>}
                      </span>
                      <span className="block text-xs text-ink-muted">{task.hint}</span>
                    </span>
                    <Link to={task.to(list)} onClick={(e) => e.stopPropagation()} className={buttonClasses('secondary', 'sm', 'hidden sm:inline-flex')}>
                      {task.action}
                    </Link>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-faint transition-transform group-open:rotate-90" />
                  </summary>
                  <ul className="border-t border-divider bg-canvas/60 px-5 py-1.5">
                    {list.slice(0, PREVIEW).map((item) => (
                      <li key={item.id} className="flex items-center gap-3 py-2 pl-12">
                        <span className="min-w-0 flex-1">
                          <Link to={attentionLink(item)} className="block truncate text-sm font-medium text-ink hover:text-brand hover:underline">
                            {item.title}
                          </Link>
                          <span className="block text-xs text-ink-muted">{item.reason}</span>
                        </span>
                        {task.kind === 'overdue' && (
                          <Button size="sm" onClick={() => onRecordPayment(item.studentId!)}>
                            Record payment<span className="sr-only"> for {item.title}</span>
                          </Button>
                        )}
                      </li>
                    ))}
                    {list.length > PREVIEW && (
                      <li className="py-2 pl-12">
                        <Link to={task.to(list)} className="text-sm font-medium text-brand hover:underline">
                          See all {list.length}
                        </Link>
                      </li>
                    )}
                    <li className="py-2 pl-12 sm:hidden">
                      <Link to={task.to(list)} className="text-sm font-medium text-brand hover:underline">
                        {task.action}
                      </Link>
                    </li>
                  </ul>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
