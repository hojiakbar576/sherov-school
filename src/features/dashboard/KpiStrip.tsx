import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { CalendarDays, ClipboardCheck, Users, Wallet, WalletCards, type LucideIcon } from 'lucide-react'
import { formatNumber, formatPercent, formatUZSCompact } from '../../lib/format'
import type { MarkSummary } from '../../lib/metrics'
import { cn } from '../../lib/cn'
import { tr } from '../../i18n'

interface KpiProps {
  /** Where the card leads, with the matching filter applied. Without one the card is plain text. */
  to?: string
  icon: LucideIcon
  label: string
  value: ReactNode
  detail: ReactNode
  tone?: 'default' | 'danger'
}

function Kpi({ to, icon: Icon, label, value, detail, tone = 'default' }: KpiProps) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-sm text-ink-muted">
        <Icon aria-hidden className="size-4 text-ink-faint" />
        {label}
      </span>
      <span className={cn('num text-[1.75rem] leading-9 font-semibold tracking-[-0.02em]', tone === 'danger' ? 'text-danger' : 'text-ink')}>{value}</span>
      <span className="text-xs text-ink-muted">{detail}</span>
    </>
  )
  const base = 'flex min-w-0 flex-col gap-1 bg-surface px-5 py-4'
  return to ? (
    <Link to={to} className={cn(base, 'group hover:bg-canvas focus-visible:-outline-offset-2')}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  )
}

interface KpiStripProps {
  activeStudents: number
  activeGroups: number
  classes: { total: number; recorded: number; missing: number }
  today: MarkSummary
  revenue: { total: number; count: number }
  outstanding: { total: number; students: number; overdueStudents: number; overdueTotal: number }
  /** Destination for each card; a missing one (e.g. a page this role can't open) makes the card plain. */
  links: { students?: string; classes?: string; attendance?: string; revenue?: string; debt?: string }
}

/** The five numbers checked first. Each opens the page behind it, already filtered. */
export function KpiStrip({ activeStudents, activeGroups, classes, today, revenue, outstanding, links }: KpiStripProps) {
  return (
    <section aria-label={tr("Key figures")} className="grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 xl:grid-cols-5 [&>*:last-child]:sm:col-span-2 [&>*:last-child]:xl:col-span-1">
      <Kpi to={links.students} icon={Users} label={tr("Active students")} value={formatNumber(activeStudents)} detail={tr("In {0} running groups", activeGroups)} />
      <Kpi
        to={links.classes}
        icon={CalendarDays}
        label={tr("Classes today")}
        value={formatNumber(classes.total)}
        tone={classes.missing > 0 ? 'danger' : 'default'}
        detail={
          classes.total === 0 ? tr("No classes today") : classes.missing > 0 ? tr("{0} ended without attendance", classes.missing) : tr("{0} of {1} with attendance taken", classes.recorded, classes.total)
        }
      />
      <Kpi
        to={links.attendance}
        icon={ClipboardCheck}
        label={tr("Attendance today")}
        value={today.rate === null ? '—' : formatPercent(today.rate)}
        detail={today.rate === null ? tr("No attendance taken yet today") : tr("{0} of {1} students came", today.present + today.late, today.total)}
      />
      <Kpi to={links.revenue} icon={Wallet} label={tr("Collected this month")} value={formatUZSCompact(revenue.total)} detail={tr("{0} payments received", formatNumber(revenue.count))} />
      <Kpi
        to={links.debt}
        icon={WalletCards}
        label={tr("Overdue tuition")}
        value={formatUZSCompact(outstanding.overdueTotal)}
        tone={outstanding.overdueStudents > 0 ? 'danger' : 'default'}
        detail={tr("{0} students overdue, {1} more not paid yet", outstanding.overdueStudents, outstanding.students - outstanding.overdueStudents)}
      />
    </section>
  )
}
