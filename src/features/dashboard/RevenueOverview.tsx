import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router'
import { Panel } from '../../components/ui/Panel'
import { RangeToggle } from '../../components/ui/RangeToggle'
import { axisProps, CHART_COLORS, tooltipStyle } from '../../components/charts/chartTheme'
import { useSchool } from '../../data/school-context'
import { formatAxisAmount, formatPercent, formatUZS, formatUZSCompact } from '../../lib/format'
import { revenueByMonth, type RevenuePoint } from '../../lib/metrics'
import { cn } from '../../lib/cn'
import { tr } from '../../i18n'

type Range = '6' | '12'
const RANGES: { value: Range; label: string }[] = [
  { value: '6', label: tr("6 months") },
  { value: '12', label: tr("12 months") },
]

/**
 * Income by month: paid payments by payment date, from the same records as
 * the Payments page (lib/metrics revenueInMonth). The current month is still
 * running, so the trend compares the last two complete months.
 */
export function RevenueOverview({ className }: { className?: string }) {
  const { data, now } = useSchool()
  const [range, setRange] = useState<Range>('6')
  const points: RevenuePoint[] = useMemo(() => revenueByMonth(data, now, Number(range)), [data, now, range])
  const total = points.reduce((sum, p) => sum + p.total, 0)
  const [before, last] = points.slice(-3, -1)
  const change = before && last && before.total > 0 ? (last.total - before.total) / before.total : null

  return (
    <Panel
      id="revenue-overview"
      title={tr("Income by month")}
      description={tr("{0} in the last {1}", formatUZSCompact(total), range === '6' ? tr("6 months") : tr("12 months"))}
      actions={<RangeToggle label={tr("Revenue period")} value={range} options={RANGES} onChange={setRange} />}
      className={className}
    >
      {last && (
        <p className="mb-3 text-sm text-ink-muted">
          <span className="font-medium text-ink">{last.fullLabel}:</span> <span className="num">{formatUZS(last.total)}</span>
          {change !== null && (
            <>
              {' · '}
              <span className={cn('num font-medium', change >= 0 ? 'text-success' : 'text-danger')}>
                {change >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(change))}
              </span>{' '}
              {change >= 0 ? tr("more than {0}", before.fullLabel) : tr("less than {0}", before.fullLabel)}
            </>
          )}
        </p>
      )}
      <div className="h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: -8 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="label" {...axisProps} interval={0} fontSize={11} />
            <YAxis tickFormatter={formatAxisAmount} {...axisProps} width={48} />
            <Tooltip
              {...tooltipStyle}
              formatter={(value) => [formatUZS(Number(value)), tr("Collected")]}
              labelFormatter={(_, payload) => (payload?.[0]?.payload as RevenuePoint | undefined)?.fullLabel ?? ''}
            />
            <Bar dataKey="total" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {points.map((p, i) => (
                // The current, still-growing month is drawn lighter.
                <Cell key={p.key} fill={i === points.length - 1 ? CHART_COLORS.revenueMuted : CHART_COLORS.revenue} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {tr("Paid payments by payment date. The lighter bar is this month, still in progress.")}{' '}
        <Link to="/reports" className="font-medium text-brand hover:underline">
          {tr("More in Reports")}
        </Link>
      </p>
      <table className="sr-only">
        <caption>{tr("Income by month")}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.fullLabel}</th>
              <td>{formatUZS(p.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}
