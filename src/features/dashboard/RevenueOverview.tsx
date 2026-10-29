import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Panel } from '../../components/ui/Panel'
import { RangeToggle } from '../../components/ui/RangeToggle'
import { axisProps, CHART_COLORS, tooltipStyle } from '../../components/charts/chartTheme'
import { useSchool } from '../../data/school-context'
import { formatAxisAmount, formatUZS, formatUZSCompact } from '../../lib/format'
import { revenueByMonth, revenueByWeek, type RevenuePoint } from '../../lib/metrics'

type Range = 'months' | 'weeks'
const RANGES: { value: Range; label: string }[] = [
  { value: 'months', label: '6 months' },
  { value: 'weeks', label: '8 weeks' },
]

export function RevenueOverview() {
  const { data, now } = useSchool()
  const [range, setRange] = useState<Range>('months')
  const points: RevenuePoint[] = range === 'months' ? revenueByMonth(data, now, 6) : revenueByWeek(data, now, 8)
  const total = points.reduce((sum, p) => sum + p.total, 0)

  return (
    <Panel
      id="revenue-overview"
      title="Revenue collected"
      description={`${formatUZSCompact(total)} in the last ${range === 'months' ? '6 months' : '8 weeks'}`}
      actions={<RangeToggle label="Revenue period" value={range} options={RANGES} onChange={setRange} />}
    >
      <div className="h-[17.5rem]" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: -8 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="label" {...axisProps} interval={0} fontSize={11} />
            <YAxis tickFormatter={formatAxisAmount} {...axisProps} width={48} />
            <Tooltip
              {...tooltipStyle}
              formatter={(value) => [formatUZS(Number(value)), 'Collected']}
              labelFormatter={(_, payload) => (payload?.[0]?.payload as RevenuePoint | undefined)?.fullLabel ?? ''}
            />
            <Bar dataKey="total" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {points.map((p, i) => (
                // The current, still-growing period is drawn lighter.
                <Cell key={p.key} fill={i === points.length - 1 ? CHART_COLORS.revenueMuted : CHART_COLORS.revenue} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-ink-muted">Paid payments by payment date. The lighter bar is the current {range === 'months' ? 'month' : 'week'}, still in progress.</p>
      <table className="sr-only">
        <caption>Revenue collected by {range === 'months' ? 'month' : 'week'}</caption>
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
