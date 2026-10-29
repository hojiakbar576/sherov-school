import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { ClipboardCheck, Users, Wallet, WalletCards, type LucideIcon } from 'lucide-react'
import { formatNumber, formatPercent, formatUZSCompact } from '../../lib/format'
import type { MarkSummary } from '../../lib/metrics'
import { cn } from '../../lib/cn'

interface KpiProps {
  to: string
  icon: LucideIcon
  label: string
  value: ReactNode
  detail: ReactNode
  tone?: 'default' | 'danger'
}

function Kpi({ to, icon: Icon, label, value, detail, tone = 'default' }: KpiProps) {
  return (
    <Link to={to} className="flex min-w-0 flex-col gap-1 bg-surface px-5 py-4 hover:bg-canvas focus-visible:-outline-offset-2">
      <span className="flex items-center gap-2 text-sm text-ink-muted">
        <Icon aria-hidden className="size-4 text-ink-faint" />
        {label}
      </span>
      <span className={cn('num text-[1.75rem] leading-9 font-semibold tracking-[-0.02em]', tone === 'danger' ? 'text-danger' : 'text-ink')}>{value}</span>
      <span className="text-xs text-ink-muted">{detail}</span>
    </Link>
  )
}

interface KpiStripProps {
  activeStudents: number
  activeGroups: number
  today: MarkSummary & { sessionsPlanned: number; sessionsRecorded: number }
  revenue: { total: number; count: number }
  outstanding: { total: number; students: number; overdueStudents: number }
}

/** The four headline numbers in one ruled strip (hairlines come from the 1px gap). */
export function KpiStrip({ activeStudents, activeGroups, today, revenue, outstanding }: KpiStripProps) {
  return (
    <section aria-label="Key figures" className="grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
      <Kpi to="/students" icon={Users} label="Active students" value={formatNumber(activeStudents)} detail={`In ${activeGroups} running groups`} />
      <Kpi
        to="/attendance"
        icon={ClipboardCheck}
        label="Attendance today"
        value={today.rate === null ? '—' : formatPercent(today.rate)}
        detail={
          today.rate === null
            ? today.sessionsPlanned
              ? `No attendance taken yet, ${today.sessionsPlanned} classes today`
              : 'No classes today'
            : `${today.present + today.late} of ${today.total} attended, ${today.sessionsRecorded} of ${today.sessionsPlanned} classes taken`
        }
      />
      <Kpi to="/payments" icon={Wallet} label="Revenue this month" value={formatUZSCompact(revenue.total)} detail={`${formatNumber(revenue.count)} paid payments`} />
      <Kpi
        to="/students?tuition=owing"
        icon={WalletCards}
        label="Outstanding tuition"
        value={formatUZSCompact(outstanding.total)}
        tone={outstanding.overdueStudents > 0 ? 'danger' : 'default'}
        detail={`${outstanding.students} students owe, ${outstanding.overdueStudents} overdue`}
      />
    </section>
  )
}
