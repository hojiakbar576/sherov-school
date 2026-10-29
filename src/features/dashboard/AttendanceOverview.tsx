import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Panel } from '../../components/ui/Panel'
import { ButtonLink } from '../../components/ui/Button'
import { axisProps, CHART_COLORS, tooltipStyle } from '../../components/charts/chartTheme'
import { formatPercent } from '../../lib/format'
import type { DayAttendance } from '../../lib/metrics'

const SERIES = [
  { key: 'present', label: 'Present', color: CHART_COLORS.present },
  { key: 'late', label: 'Late', color: CHART_COLORS.late },
  { key: 'absent', label: 'Absent', color: CHART_COLORS.absent },
] as const

export function AttendanceOverview({ days }: { days: DayAttendance[] }) {
  const week = days.reduce(
    (sum, d) => ({ present: sum.present + d.present, late: sum.late + d.late, absent: sum.absent + d.absent, total: sum.total + d.total }),
    { present: 0, late: 0, absent: 0, total: 0 },
  )
  const rate = week.total ? (week.present + week.late) / week.total : null

  return (
    <Panel
      id="attendance-overview"
      title="Attendance this week"
      description={rate === null ? 'No attendance taken this week yet' : `${formatPercent(rate)} attended across ${week.total} student check-ins`}
      actions={<ButtonLink to="/attendance" size="sm">Take attendance</ButtonLink>}
    >
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-ink-muted">{s.label}</span>
            <span className="num font-medium text-ink">{week[s.key]}</span>
          </li>
        ))}
      </ul>
      <div className="h-60" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days} margin={{ top: 4, right: 0, bottom: 0, left: -8 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} width={44} />
            <Tooltip
              {...tooltipStyle}
              formatter={(value, name) => [value, SERIES.find((s) => s.key === name)?.label ?? name]}
              labelFormatter={(label, payload) => {
                const day = payload?.[0]?.payload as DayAttendance | undefined
                return day ? `${label}: ${day.sessionsRecorded} of ${day.sessionsPlanned} classes recorded` : label
              }}
            />
            {SERIES.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} stackId="day" fill={s.color} radius={i === SERIES.length - 1 ? [3, 3, 0, 0] : 0} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Attendance by day this week</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Present</th>
            <th scope="col">Late</th>
            <th scope="col">Absent</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.label}</th>
              <td>{d.isFuture ? 'Not yet' : d.present}</td>
              <td>{d.isFuture ? '' : d.late}</td>
              <td>{d.isFuture ? '' : d.absent}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {days.some((d) => d.isFuture) && (
        <p className="mt-2 text-xs text-ink-muted">Days still to come are left empty. Today shows only classes taken so far.</p>
      )}
    </Panel>
  )
}
