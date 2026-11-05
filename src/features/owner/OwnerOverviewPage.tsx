import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, CircleCheck } from 'lucide-react'
import type { BranchSummary } from '../../lib/owner'
import { useSchool } from '../../data/school-context'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { TableScroll, td, th } from '../../components/ui/misc'
import { formatLongDate, formatNumber, formatPercent, formatUZSCompact, greeting } from '../../lib/format'
import { branchSummaries, change, organisationTotals } from '../../lib/owner'
import { cn } from '../../lib/cn'
import { formatChange } from './owner-ui'
import { plural, tr } from '../../i18n'

/**
 * The owner's first screen: how the whole school is doing, how the three
 * branches compare, and where to look first.
 */
export function OwnerOverviewPage() {
  const { owner, now } = useSchool()
  const navigate = useNavigate()
  const data = owner!.data
  const rows = useMemo(() => branchSummaries(data, now), [data, now])
  const totals = useMemo(() => organisationTotals(data, rows, now), [data, rows, now])
  // Compared with the same point last month, so early in the month doesn't look like a drop.
  const revenueChange = change(totals.revenueThisMonth, totals.revenueLastMonthToDate)

  // Open a branch's administrator pages, narrowed to that branch.
  const openBranch = (branchId: string, path = '/') => {
    owner!.setBranch(branchId)
    navigate(path)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink">{greeting(now)}{tr(", Mr. Sherzod")}</h1>
        <p className="mt-1 text-ink-muted">
          {data.settings.centerName}{tr(": all")}{' '}{data.branches.length}{' '}{tr("branches,")}{' '}{formatLongDate(now)}.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-5">
        <Kpi label={tr("Active students")} value={formatNumber(totals.activeStudents)} detail={tr("+{0} joined, {1} left this month", totals.newStudentsThisMonth, totals.leftThisMonth)} />
        <Kpi
          label={tr("Collected this month")}
          value={formatUZSCompact(totals.revenueThisMonth)}
          detail={revenueChange === null ? tr("Nothing collected by this date last month") : tr("{0} on the same point last month", formatChange(revenueChange))}
        />
        <Kpi label={tr("Overdue tuition")} value={formatUZSCompact(totals.overdue)} tone={totals.overdue > 0 ? 'danger' : undefined} detail={tr("{0} students past the due day", totals.overdueStudents)} />
        <Kpi label={tr("Attendance, 30 days")} value={totals.attendanceRate === null ? '—' : formatPercent(totals.attendanceRate)} detail={tr("{0} running groups, {1} of seats filled", totals.runningGroups, totals.fill === null ? '—' : formatPercent(totals.fill))} />
        <Kpi label={tr("Open enquiries")} value={formatNumber(totals.openLeads)} detail={tr("Not yet enrolled or lost")} className="col-span-2 lg:col-span-1" />
      </dl>

      <Panel title={tr("Branches side by side")} description={tr("This month so far. Click a branch to work in it.")} flush>
        <BranchTable rows={rows} totals={totals} onOpen={(id) => openBranch(id)} />
      </Panel>

      <Panel title={tr("Where to look")} description={tr("The biggest open issues in each branch, from its administrator’s task list.")} flush>
        <WhereToLook rows={rows} onOpen={openBranch} />
      </Panel>
    </div>
  )
}

function Kpi({ label, value, detail, tone, className }: { label: string; value: ReactNode; detail: ReactNode; tone?: 'danger'; className?: string }) {
  return (
    <div className={cn('min-w-0 bg-surface px-5 py-4', className)}>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className={cn('num mt-1 text-[1.6rem] leading-8 font-semibold tracking-[-0.02em]', tone === 'danger' ? 'text-danger' : 'text-ink')}>{value}</dd>
      <dd className="mt-0.5 text-xs text-ink-muted">{detail}</dd>
    </div>
  )
}

type Totals = ReturnType<typeof organisationTotals>

/** One row per branch; the weakest value in a column is marked so it stands out. */
function BranchTable({ rows, totals, onOpen }: { rows: BranchSummary[]; totals: Totals; onOpen: (branchId: string) => void }) {
  const lowest = (pick: (r: BranchSummary) => number | null) => {
    const values = rows.map(pick).filter((v): v is number => v !== null)
    return values.length > 1 ? Math.min(...values) : null
  }
  const highest = (pick: (r: BranchSummary) => number) => (rows.length > 1 ? Math.max(...rows.map(pick)) : null)
  const worstAttendance = lowest((r) => r.attendanceRate)
  const worstOverdue = highest((r) => r.overdue)
  const worstFill = lowest((r) => r.fill)

  return (
    <TableScroll>
      <table className="w-full min-w-[900px] text-sm">
        <caption className="sr-only">{tr("Branch comparison for this month")}</caption>
        <thead className="border-y border-line bg-canvas">
          <tr>
            <th scope="col" className={th}>{tr("Branch")}</th>
            <th scope="col" className={cn(th, 'text-right')}>{tr("Students")}</th>
            <th scope="col" className={cn(th, 'text-right')}>{tr("Groups filled")}</th>
            <th scope="col" className={cn(th, 'text-right')}>{tr("Collected")}</th>
            <th scope="col" className={cn(th, 'text-right')}>{tr("Overdue")}</th>
            <th scope="col" className={cn(th, 'text-right')}>{tr("Attendance")}</th>
            <th scope="col" className={cn(th, 'text-right')}>{tr("Joined / left")}</th>
            <th scope="col" className={cn(th, 'text-right')}>{tr("Enquiries")}</th>
            <th scope="col" className={th}><span className="sr-only">{tr("Open")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.branch.id} onClick={() => onOpen(r.branch.id)} className="cursor-pointer hover:bg-canvas/70">
              <th scope="row" className={cn(td, 'text-left font-normal')}>
                <span className="block font-medium text-ink">{r.branch.name}</span>
                <span className="block text-xs text-ink-muted">{r.adminName ?? tr("No administrator")} · {r.activeTeachers}{' '}{tr("teachers")}</span>
              </th>
              <td className={cn(td, 'num text-right')}>
                {r.activeStudents}
                {r.pausedStudents > 0 && <span className="block text-xs text-ink-muted">+{r.pausedStudents}{' '}{tr("paused")}</span>}
              </td>
              <td className={cn(td, 'num text-right', r.fill === worstFill && 'text-warning')}>
                {r.fill === null ? '—' : formatPercent(r.fill)}
                <span className="block text-xs text-ink-muted">{r.runningGroups}{' '}{tr("groups")}</span>
              </td>
              <td className={cn(td, 'num text-right')}>
                {formatUZSCompact(r.revenueThisMonth)}
                <span className="block text-xs text-ink-muted">{formatChange(change(r.revenueThisMonth, r.revenueLastMonthToDate)) || '—'}{' '}{tr("vs same point last month")}</span>
              </td>
              <td className={cn(td, 'num text-right', r.overdue > 0 && r.overdue === worstOverdue && 'font-medium text-danger')}>
                {formatUZSCompact(r.overdue)}
                <span className="block text-xs text-ink-muted">{r.overdueStudents}{' '}{tr("students")}</span>
              </td>
              <td className={cn(td, 'num text-right', r.attendanceRate === worstAttendance && 'text-warning')}>{r.attendanceRate === null ? '—' : formatPercent(r.attendanceRate)}</td>
              <td className={cn(td, 'num text-right')}>
                +{r.newStudentsThisMonth} / −{r.leftThisMonth}
              </td>
              <td className={cn(td, 'num text-right')}>
                {r.openLeads}{' '}{tr("open")}
                <span className="block text-xs text-ink-muted">{r.conversion === null ? tr("No results yet") : tr("{0} enrol", formatPercent(r.conversion))}</span>
              </td>
              <td className={cn(td, 'text-right')}>
                <ArrowRight aria-hidden className="ml-auto size-4 text-ink-faint" />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-line-strong bg-canvas/60 font-medium">
          <tr>
            <th scope="row" className={cn(td, 'text-left')}>{tr("All branches")}</th>
            <td className={cn(td, 'num text-right')}>{totals.activeStudents}</td>
            <td className={cn(td, 'num text-right')}>{totals.fill === null ? '—' : formatPercent(totals.fill)}</td>
            <td className={cn(td, 'num text-right')}>{formatUZSCompact(totals.revenueThisMonth)}</td>
            <td className={cn(td, 'num text-right')}>{formatUZSCompact(totals.overdue)}</td>
            <td className={cn(td, 'num text-right')}>{totals.attendanceRate === null ? '—' : formatPercent(totals.attendanceRate)}</td>
            <td className={cn(td, 'num text-right')}>
              +{totals.newStudentsThisMonth} / −{totals.leftThisMonth}
            </td>
            <td className={cn(td, 'num text-right')}>{totals.openLeads}{' '}{tr("open")}</td>
            <td className={td} />
          </tr>
        </tfoot>
      </table>
    </TableScroll>
  )
}

interface Issue {
  branchId: string
  branch: string
  text: string
  action: string
  path: string
  /** Higher sorts first. */
  weight: number
}

const count = (n: number, one: string, many: string) => `${n} ${plural(n, one, many)}`

function issuesFor(r: BranchSummary): Issue[] {
  const n = (k: keyof BranchSummary['tasks']) => r.tasks[k] ?? 0
  const base = { branchId: r.branch.id, branch: r.branch.name }
  const items: Issue[] = []
  if (r.overdueStudents) items.push({ ...base, text: tr("{0} with overdue tuition ({1})", count(r.overdueStudents, 'student', 'students'), formatUZSCompact(r.overdue)), action: tr("Debtors"), path: '/payments?view=owing', weight: 50 + r.overdueStudents })
  if (n('attendance_missing')) items.push({ ...base, text: tr("{0} from the last week without attendance", count(n('attendance_missing'), 'class', 'classes')), action: tr("Attendance"), path: '/', weight: 60 + n('attendance_missing') })
  if (n('teacher_away')) items.push({ ...base, text: tr("{0} without an available teacher", count(n('teacher_away'), 'running group', 'running groups')), action: tr("Groups"), path: '/groups', weight: 80 })
  if (n('trial_result') + n('lead_new')) {
    const parts = [n('lead_new') && tr('{0} waiting for a call', count(n('lead_new'), 'enquiry', 'enquiries')), n('trial_result') && tr('{0} not recorded', count(n('trial_result'), 'trial result', 'trial results'))].filter(Boolean)
    items.push({ ...base, text: parts.join(', '), action: tr("Admissions"), path: '/leads', weight: 30 + n('lead_new') })
  }
  if (n('absences')) items.push({ ...base, text: tr("{0} missed 3+ classes in two weeks", count(n('absences'), 'student', 'students')), action: tr("Dashboard"), path: '/', weight: 20 + n('absences') })
  return items
}

function WhereToLook({ rows, onOpen }: { rows: BranchSummary[]; onOpen: (branchId: string, path: string) => void }) {
  const issues = rows.flatMap(issuesFor).sort((a, b) => b.weight - a.weight)
  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-2 border-t border-line px-5 py-4 text-sm text-ink-muted">
        <CircleCheck aria-hidden className="size-4 text-success" />
        {tr("Nothing stands out in any branch today.")}
      </p>
    )
  }
  return (
    <ul className="divide-y divide-line border-t border-line">
      {issues.slice(0, 8).map((i) => (
        <li key={`${i.branchId}-${i.action}-${i.text}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
          <span className="w-24 shrink-0 font-medium text-ink">{i.branch}</span>
          <span className="min-w-0 flex-1 basis-56 text-ink-muted">{i.text}</span>
          <Button size="sm" variant="ghost" onClick={() => onOpen(i.branchId, i.path)}>
            {i.action}
            <ArrowRight aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  )
}
