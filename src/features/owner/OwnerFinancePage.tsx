import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useSchool } from '../../data/school-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { TableScroll, td, th } from '../../components/ui/misc'
import { axisProps, CHART_COLORS, tooltipStyle } from '../../components/charts/chartTheme'
import { monthKey, toISODate } from '../../lib/dates'
import { formatAxisAmount, formatMonth, formatPercent, formatUZS, formatUZSCompact, methodName} from '../../lib/format'
import { branchSummaries, revenueByBranch } from '../../lib/owner'
import { teacherSalary } from '../../lib/salary'
import { ExportButtons } from '../../components/ui/ExportButtons'
import { cn } from '../../lib/cn'
import { BRANCH_COLORS } from './owner-ui'
import { tr } from '../../i18n'

/** Money across the organisation: what came in, what's owed, and what goes to teachers. */
export function OwnerFinancePage() {
  const { owner, now } = useSchool()
  const navigate = useNavigate()
  const data = owner!.data
  const month = monthKey(now)
  const months = useMemo(() => revenueByBranch(data, now, 6), [data, now])
  const rows = useMemo(() => branchSummaries(data, now), [data, now])
  const branches = data.branches

  // Teacher pay this month: each teacher's share of tuition paid for this month, plus bonuses.
  const pay = useMemo(
    () =>
      data.teachers
        .map((t) => ({ teacher: t, salary: teacherSalary(data, t.id, month), bonus: data.bonuses.filter((b) => b.teacherId === t.id && b.month === month).reduce((s, b) => s + b.amount, 0) }))
        .filter((p) => p.salary.amount > 0 || p.bonus > 0)
        .sort((a, b) => b.salary.amount + b.bonus - (a.salary.amount + a.bonus)),
    [data, month],
  )
  const methods = data.catalogs.paymentMethods.map((pm) => pm.id).map((m) => {
    const list = data.payments.filter((p) => p.status === 'paid' && p.method === m && p.date.startsWith(month))
    return { method: m, count: list.length, total: list.reduce((s, p) => s + p.amount, 0) }
  })
  const methodsTotal = methods.reduce((s, m) => s + m.total, 0)
  const branchName = new Map(branches.map((b) => [b.id, b.name]))
  const sixMonthTotal = months.reduce((s, m) => s + m.total, 0)

  const exportRevenue = () => [
    [tr("Month"), ...branches.map((b) => b.name), tr("Total (UZS)")],
    ...months.map((m) => [m.fullLabel, ...branches.map((b) => m.byBranch[b.id] ?? 0), m.total]),
  ]

  return (
    <>
      <PageHeader
        title={tr("Finance")}
        description={tr("Tuition collected by branch, what is still owed, and teacher pay. Paid payments only; pending and refunded ones don’t count.")}
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportButtons name="revenue-by-branch" date={toISODate(now)} rows={exportRevenue} />
          </div>
        }
      />

      <div className="space-y-6">
        <Panel title={tr("Collected by branch")} description={tr("{0} in the last 6 months. The current month is still in progress.", formatUZSCompact(sixMonthTotal))}>
          <div className="h-72" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months.map((m) => ({ ...m, ...m.byBranch }))} margin={{ top: 8, right: 0, bottom: 0, left: -8 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="label" {...axisProps} interval={0} fontSize={11} />
                <YAxis tickFormatter={formatAxisAmount} {...axisProps} width={48} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value, name) => [formatUZS(Number(value)), branchName.get(String(name)) ?? String(name)]}
                  labelFormatter={(_, payload) => (payload?.[0]?.payload as { fullLabel?: string } | undefined)?.fullLabel ?? ''}
                />
                {branches.map((b, i) => (
                  <Bar key={b.id} dataKey={b.id} stackId="revenue" fill={BRANCH_COLORS[i % BRANCH_COLORS.length]} isAnimationActive={false} radius={i === branches.length - 1 ? [3, 3, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted" aria-label={tr("Branch colours")}>
            {branches.map((b, i) => (
              <li key={b.id} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm" style={{ background: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
                {b.name}
              </li>
            ))}
          </ul>
          <TableScroll>
            <table className="mt-4 w-full min-w-[560px] text-sm">
              <caption className="sr-only">{tr("Tuition collected by branch and month")}</caption>
              <thead className="border-y border-line bg-canvas">
                <tr>
                  <th scope="col" className={th}>{tr("Month")}</th>
                  {branches.map((b) => (
                    <th key={b.id} scope="col" className={cn(th, 'text-right')}>
                      {b.name}
                    </th>
                  ))}
                  <th scope="col" className={cn(th, 'text-right')}>{tr("Total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...months].reverse().map((m) => (
                  <tr key={m.month}>
                    <th scope="row" className={cn(td, 'text-left font-normal text-ink')}>
                      {m.fullLabel}
                      {m.month === month && <span className="ml-1.5 text-xs text-ink-muted">{tr("(so far)")}</span>}
                    </th>
                    {branches.map((b) => (
                      <td key={b.id} className={cn(td, 'num text-right')}>
                        {formatUZSCompact(m.byBranch[b.id] ?? 0)}
                      </td>
                    ))}
                    <td className={cn(td, 'num text-right font-medium')}>{formatUZSCompact(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Panel>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Panel title={tr("Still owed")} description={tr("Tuition active students haven’t paid yet, by branch.")} flush>
            <ul className="divide-y divide-line border-t border-line">
              {rows.map((r) => (
                <li key={r.branch.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <span className="w-24 shrink-0 font-medium text-ink">{r.branch.name}</span>
                  <span className="num min-w-0 flex-1 text-ink-muted">
                    {formatUZS(r.owed)}{' '}{tr("owed ·")}{' '}<span className={cn(r.overdue > 0 && 'text-danger')}>{formatUZS(r.overdue)}{' '}{tr("overdue")}</span> ({r.overdueStudents}{' '}{tr("students)")}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      owner!.setBranch(r.branch.id)
                      navigate('/payments?view=owing')
                    }}
                  >
                    {tr("See debtors")}
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={tr("How people paid in {0}", formatMonth(month))} flush>
            <ul className="divide-y divide-line border-t border-line">
              {methods.map((m) => (
                <li key={m.method} className="flex items-center gap-4 px-5 py-2.5 text-sm">
                  <span className="w-40 shrink-0 text-ink">{methodName(data.catalogs, m.method)}</span>
                  <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${methodsTotal ? (m.total / methodsTotal) * 100 : 0}%` }} />
                  </span>
                  <span className="num w-28 text-right text-ink-muted">
                    {formatUZSCompact(m.total)} <span className="text-xs">({m.count})</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel
          title={tr("Teacher pay for {0}", formatMonth(month))}
          description={tr("So far: each teacher’s share of the tuition their students paid for this month, plus bonuses awarded for the month.")}
          flush
        >
          <TableScroll>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-y border-line bg-canvas">
                <tr>
                  <th scope="col" className={th}>{tr("Teacher")}</th>
                  <th scope="col" className={th}>{tr("Branch")}</th>
                  <th scope="col" className={cn(th, 'text-right')}>{tr("Tuition paid")}</th>
                  <th scope="col" className={cn(th, 'text-right')}>{tr("Share")}</th>
                  <th scope="col" className={cn(th, 'text-right')}>{tr("Pay")}</th>
                  <th scope="col" className={cn(th, 'text-right')}>{tr("Bonus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pay.map(({ teacher, salary, bonus }) => (
                  <tr key={teacher.id}>
                    <td className={cn(td, 'font-medium text-ink')}>{teacher.fullName}</td>
                    <td className={cn(td, 'text-ink-muted')}>{branchName.get(teacher.branchId)}</td>
                    <td className={cn(td, 'num text-right')}>{formatUZSCompact(salary.collected)}</td>
                    <td className={cn(td, 'num text-right text-ink-muted')}>{formatPercent(teacher.salaryPercent / 100)}</td>
                    <td className={cn(td, 'num text-right font-medium')}>{formatUZS(salary.amount)}</td>
                    <td className={cn(td, 'num text-right')}>{bonus ? formatUZS(bonus) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line-strong font-medium">
                <tr>
                  <th scope="row" colSpan={4} className={cn(td, 'text-left')}>
                    {tr("Total")}
                  </th>
                  <td className={cn(td, 'num text-right')}>{formatUZS(pay.reduce((s, p) => s + p.salary.amount, 0))}</td>
                  <td className={cn(td, 'num text-right')}>{formatUZS(pay.reduce((s, p) => s + p.bonus, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </TableScroll>
        </Panel>
      </div>
    </>
  )
}
