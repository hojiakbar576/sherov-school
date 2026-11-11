import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router'
import { ChartNoAxesCombined, Info } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { EmptyState } from '../../components/ui/misc'
import { axisProps, CHART_COLORS, tooltipStyle } from '../../components/charts/chartTheme'
import { formatAxisAmount, formatUZS } from '../../lib/format'
import type { FinanceMonth } from '../../lib/owner-dashboard'
import { tr } from '../../i18n'

const COLORS = {
  income: CHART_COLORS.revenue,
  expenses: 'var(--color-cat-orange)',
  salaries: 'var(--color-warning-mark)',
  profit: 'var(--color-ink)',
}

interface Props {
  rows: FinanceMonth[]
  hasAny: boolean
  /** Months with income but no expenses recorded, so the owner knows what is missing. */
  monthsWithoutCosts: number
  className?: string
}

/**
 * Income against what went out (expenses plus teacher pay, stacked) for the
 * last 12 months, with profit as a line. Months whose costs aren't recorded
 * have no profit point rather than a flattering one.
 */
export function OwnerFinanceChart({ rows, hasAny, monthsWithoutCosts, className }: Props) {
  const series: [keyof typeof COLORS, string][] = [
    ['income', tr("Income")],
    ['expenses', tr("Expenses")],
    ['salaries', tr("Teacher pay")],
    ['profit', tr("Profit")],
  ]
  const name = Object.fromEntries(series) as Record<string, string>

  return (
    <Panel
      id="owner-finance"
      title={tr("Income and expenses")}
      description={tr("Last 12 months. Expenses include teacher pay.")}
      actions={
        <Link to="/owner/finance" className="text-sm font-medium text-brand hover:underline">
          {tr("Finance details")}
        </Link>
      }
      className={className}
    >
      {!hasAny ? (
        <EmptyState icon={ChartNoAxesCombined} title={tr("No payments or expenses recorded yet")}>
          {tr("The chart fills in as payments, expenses and salaries are recorded.")}
        </EmptyState>
      ) : (
        <>
          <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted" aria-hidden>
            {series.map(([key, label]) => (
              <li key={key} className="flex items-center gap-1.5">
                <span className={key === 'profit' ? 'h-0.5 w-4 rounded-full' : 'size-2.5 rounded-[3px]'} style={{ background: COLORS[key] }} />
                {label}
              </li>
            ))}
          </ul>
          <div className="h-72" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barCategoryGap="24%" barGap={2}>
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="label" {...axisProps} interval={0} fontSize={11} />
                <YAxis tickFormatter={(v: number) => (v < 0 ? `−${formatAxisAmount(-v)}` : formatAxisAmount(v))} {...axisProps} width={52} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value, key) => [formatUZS(Number(value)), name[String(key)] ?? String(key)]}
                  labelFormatter={(_, payload) => (payload?.[0]?.payload as FinanceMonth | undefined)?.fullLabel ?? ''}
                />
                <Bar dataKey="income" fill={COLORS.income} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="expenses" stackId="out" fill={COLORS.expenses} isAnimationActive={false} />
                <Bar dataKey="salaries" stackId="out" fill={COLORS.salaries} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line dataKey="profit" stroke={COLORS.profit} strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {monthsWithoutCosts > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-control bg-subtle px-3 py-2 text-xs text-ink-muted">
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {tr("{0} of these months have income but no expenses recorded, so their costs and profit are incomplete.", monthsWithoutCosts)}
            </p>
          )}
          {/* In a wrapper: a bare sr-only table keeps its natural width and would widen the page on phones. */}
          <div className="sr-only">
          <table>
            <caption>{tr("Income and expenses")}</caption>
            <thead>
              <tr>
                <th scope="col">{tr("Month")}</th>
                {series.map(([key, label]) => (
                  <th key={key} scope="col">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.fullLabel}</th>
                  <td>{formatUZS(r.income)}</td>
                  <td>{formatUZS(r.expenses)}</td>
                  <td>{formatUZS(r.salaries)}</td>
                  <td>{r.profit === null ? tr("Incomplete") : formatUZS(r.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </Panel>
  )
}
