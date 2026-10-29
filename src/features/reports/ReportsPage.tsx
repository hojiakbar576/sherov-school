import { useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download } from 'lucide-react'
import { SUBJECTS } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { RangeToggle } from '../../components/ui/RangeToggle'
import { TableScroll, td, th } from '../../components/ui/misc'
import { axisProps, CHART_COLORS, tooltipStyle } from '../../components/charts/chartTheme'
import { addMonths, monthKey, monthKeyOf, monthRange, toISODate } from '../../lib/dates'
import { formatAxisAmount, formatMonth, formatMonthShort, formatNumber, formatPercent, formatUZS, formatUZSCompact } from '../../lib/format'
import { enrolmentByGroup, enrolmentByMonth, outstandingTotal, revenueByMonth, summarizeMarks } from '../../lib/metrics'
import { downloadCSV } from '../../lib/csv'
import { cn } from '../../lib/cn'

type Range = '3' | '6'

function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="num text-xl font-semibold text-ink">{value}</p>
      {detail && <p className="text-xs text-ink-muted">{detail}</p>}
    </div>
  )
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" onClick={onClick}>
      <Download aria-hidden />
      CSV
    </Button>
  )
}

/** Small horizontal bar. Attendance rates are coloured by health; other shares stay neutral. */
function RateBar({ rate, neutral = false }: { rate: number | null; neutral?: boolean }) {
  if (rate === null) return <span className="text-ink-faint">No data</span>
  return (
    <div className="flex items-center gap-2">
      <div aria-hidden className="h-1.5 w-20 rounded-full bg-subtle">
        <div className={cn('h-1.5 rounded-full', neutral ? 'bg-accent' : rate < 0.8 ? 'bg-danger-mark' : rate < 0.88 ? 'bg-warning-mark' : 'bg-success')} style={{ width: `${rate * 100}%` }} />
      </div>
      <span className="num">{formatPercent(rate)}</span>
    </div>
  )
}

export function ReportsPage() {
  const { data, now, balances } = useSchool()
  const toast = useToast()
  const [range, setRange] = useState<Range>('6')
  const months = Number(range)
  const stamp = toISODate(now)
  const firstMonth = addMonths(monthKey(now), -(months - 1))
  const periodKeys = monthRange(firstMonth, monthKey(now))
  const periodLabel = `${formatMonth(firstMonth)} to ${formatMonth(monthKey(now))}`

  const exported = (rows: number) => toast.show(`Exported ${rows} rows.`, 'info')

  // ---- Revenue ----
  const revenue = revenueByMonth(data, now, months)
  const revenueTotal = revenue.reduce((s, r) => s + r.total, 0)
  const paymentsCount = data.payments.filter((p) => p.status === 'paid' && monthKeyOf(p.date) >= firstMonth).length

  // ---- Attendance ----
  const attendanceByMonth = periodKeys.map((key) => ({ key, ...summarizeMarks(data.attendance.filter((r) => monthKeyOf(r.date) === key)) }))
  const attendanceByGroup = data.groups
    .filter((g) => g.status === 'active')
    .map((g) => {
      const records = data.attendance.filter((r) => r.groupId === g.id && monthKeyOf(r.date) >= firstMonth)
      return { group: g, sessions: records.length, ...summarizeMarks(records) }
    })
    .sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1))
  const attendanceAll = summarizeMarks(data.attendance.filter((r) => monthKeyOf(r.date) >= firstMonth))

  // ---- Outstanding ----
  const outstanding = outstandingTotal(balances)
  const owingByGroup = (() => {
    const rows = new Map<string, { name: string; owed: number; students: number }>()
    for (const s of data.students) {
      const b = balances.get(s.id)
      if (!b || b.owed === 0) continue
      const key = s.groupId ?? 'none'
      const row = rows.get(key) ?? { name: data.groups.find((g) => g.id === s.groupId)?.name ?? 'No group', owed: 0, students: 0 }
      row.owed += b.owed
      row.students += 1
      rows.set(key, row)
    }
    return [...rows.values()].sort((a, b) => b.owed - a.owed)
  })()

  // ---- Enrolment ----
  const joined = enrolmentByMonth(data, now, months)
  const enrolment = enrolmentByGroup(data)
  const active = data.students.filter((s) => s.status === 'active')
  const bySubject = SUBJECTS.map((subject) => {
    const groups = data.groups.filter((g) => g.subject === subject && g.status === 'active')
    const students = groups.reduce((sum, g) => sum + (enrolment.get(g.id) ?? 0), 0)
    const capacity = groups.reduce((sum, g) => sum + g.capacity, 0)
    return { subject, groups: groups.length, students, capacity }
  })

  return (
    <>
      <PageHeader
        title="Reports"
        description="Summaries calculated from the same records as the rest of the app. Export any table as a CSV file."
        actions={<RangeToggle label="Report period" value={range} onChange={setRange} options={[{ value: '3', label: 'Last 3 months' }, { value: '6', label: 'Last 6 months' }]} />}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Revenue */}
        <Panel
          id="revenue-report"
          title="Revenue summary"
          description={periodLabel}
          actions={
            <ExportButton
              onClick={() => {
                downloadCSV(`sherov-school-revenue-${stamp}.csv`, [['Month', 'Collected (UZS)'], ...revenue.map((r) => [r.key, r.total])])
                exported(revenue.length)
              }}
            />
          }
        >
          <div className="mb-4 grid grid-cols-2 gap-4">
            <Stat label="Collected" value={formatUZSCompact(revenueTotal)} detail={`${formatNumber(paymentsCount)} paid payments`} />
            <Stat label="Monthly average" value={formatUZSCompact(revenueTotal / months)} />
          </div>
          <div className="h-52" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue} margin={{ top: 4, right: 0, bottom: 0, left: -8 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis tickFormatter={formatAxisAmount} {...axisProps} width={48} />
                <Tooltip {...tooltipStyle} formatter={(v) => [formatUZS(Number(v)), 'Collected']} labelFormatter={(_, p) => p?.[0]?.payload?.fullLabel ?? ''} />
                <Bar dataKey="total" fill={CHART_COLORS.revenue} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">Revenue by month</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 text-left text-xs font-medium text-ink-muted">Month</th>
                <th scope="col" className="py-2 text-right text-xs font-medium text-ink-muted">Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {revenue.map((r) => (
                <tr key={r.key}>
                  <th scope="row" className="py-2 text-left font-normal">{r.fullLabel}</th>
                  <td className="num py-2 text-right">{formatUZS(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* Attendance */}
        <Panel
          id="attendance-report"
          title="Attendance summary"
          description={`${periodLabel}. Late counts as attended.`}
          actions={
            <ExportButton
              onClick={() => {
                downloadCSV(`sherov-school-attendance-${stamp}.csv`, [
                  ['Group', 'Classes recorded', 'Present', 'Late', 'Absent', 'Attendance rate'],
                  ...attendanceByGroup.map((r) => [r.group.name, r.sessions, r.present, r.late, r.absent, r.rate === null ? '' : Math.round(r.rate * 100) + '%']),
                ])
                exported(attendanceByGroup.length)
              }}
            />
          }
          flush
        >
          <div className="grid grid-cols-3 gap-4 px-5 pb-4">
            <Stat label="Attendance rate" value={attendanceAll.rate === null ? '—' : formatPercent(attendanceAll.rate)} />
            <Stat label="Late arrivals" value={formatNumber(attendanceAll.late)} />
            <Stat label="Absences" value={formatNumber(attendanceAll.absent)} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-sm">
            {attendanceByMonth.map((m) => (
              <p key={m.key}>
                <span className="text-ink-muted">{formatMonthShort(m.key)}</span> <span className="num font-medium">{m.rate === null ? 'no records' : formatPercent(m.rate)}</span>
              </p>
            ))}
          </div>
          <TableScroll>
            <table className="w-full min-w-[460px] text-sm">
              <caption className="sr-only">Attendance by group, lowest first</caption>
              <thead className="border-y border-line bg-canvas">
                <tr>
                  <th scope="col" className={th}>Group (lowest first)</th>
                  <th scope="col" className={cn(th, 'text-right')}>Classes</th>
                  <th scope="col" className={cn(th, 'text-right')}>Absences</th>
                  <th scope="col" className={th}>Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attendanceByGroup.slice(0, 8).map((r) => (
                  <tr key={r.group.id}>
                    <th scope="row" className={cn(td, 'text-left font-normal')}>{r.group.name}</th>
                    <td className={cn(td, 'num text-right')}>{r.sessions}</td>
                    <td className={cn(td, 'num text-right')}>{r.absent}</td>
                    <td className={td}>
                      <RateBar rate={r.rate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          {attendanceByGroup.length > 8 && <p className="border-t border-line px-5 py-2.5 text-xs text-ink-muted">Showing the 8 lowest. The CSV includes all {attendanceByGroup.length} groups.</p>}
        </Panel>

        {/* Outstanding */}
        <Panel
          id="outstanding-report"
          title="Outstanding tuition"
          description="What active students owe today, by group"
          actions={
            <ExportButton
              onClick={() => {
                const rows = data.students
                  .filter((s) => (balances.get(s.id)?.owed ?? 0) > 0)
                  .map((s) => {
                    const b = balances.get(s.id)!
                    return [s.fullName, s.phone, data.groups.find((g) => g.id === s.groupId)?.name ?? '', b.owed, b.unpaidMonths.join(' '), b.status]
                  })
                downloadCSV(`sherov-school-outstanding-${stamp}.csv`, [['Student', 'Phone', 'Group', 'Owed (UZS)', 'Unpaid months', 'Status'], ...rows])
                exported(rows.length)
              }}
            />
          }
          flush
        >
          <div className="grid grid-cols-3 gap-4 px-5 pb-4">
            <Stat label="Total owed" value={formatUZSCompact(outstanding.total)} />
            <Stat label="Students owing" value={outstanding.students} />
            <Stat label="Overdue" value={outstanding.overdueStudents} detail={`After the ${data.settings.tuitionDueDay}th of the month`} />
          </div>
          <TableScroll>
            <table className="w-full min-w-[420px] text-sm">
              <caption className="sr-only">Outstanding tuition by group</caption>
              <thead className="border-y border-line bg-canvas">
                <tr>
                  <th scope="col" className={th}>Group</th>
                  <th scope="col" className={cn(th, 'text-right')}>Students</th>
                  <th scope="col" className={cn(th, 'text-right')}>Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {owingByGroup.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-6 text-center text-ink-muted">Nobody owes tuition right now.</td>
                  </tr>
                ) : (
                  owingByGroup.map((r) => (
                    <tr key={r.name}>
                      <th scope="row" className={cn(td, 'text-left font-normal')}>{r.name}</th>
                      <td className={cn(td, 'num text-right')}>{r.students}</td>
                      <td className={cn(td, 'num text-right font-medium')}>{formatUZS(r.owed)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableScroll>
        </Panel>

        {/* Enrolment */}
        <Panel
          id="enrolment-report"
          title="Student enrolment"
          description={`${active.length} active students. New enrolments from ${periodLabel}.`}
          actions={
            <ExportButton
              onClick={() => {
                downloadCSV(`sherov-school-enrolment-${stamp}.csv`, [
                  ['Subject', 'Running groups', 'Active students', 'Seats', 'Seats filled'],
                  ...bySubject.map((r) => [r.subject, r.groups, r.students, r.capacity, r.capacity ? Math.round((r.students / r.capacity) * 100) + '%' : '']),
                ])
                exported(bySubject.length)
              }}
            />
          }
        >
          <div className="h-44" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={joined} margin={{ top: 4, right: 0, bottom: 0, left: -24 }} barCategoryGap="35%">
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} width={44} />
                <Tooltip {...tooltipStyle} formatter={(v) => [v, 'New students']} labelFormatter={(_, p) => p?.[0]?.payload?.fullLabel ?? ''} />
                <Bar dataKey="joined" fill={CHART_COLORS.enrolment} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="sr-only">New students per month: {joined.map((j) => `${j.fullLabel}: ${j.joined}`).join('; ')}</p>
          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">Active students by subject</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 text-left text-xs font-medium text-ink-muted">Subject</th>
                <th scope="col" className="py-2 text-right text-xs font-medium text-ink-muted">Groups</th>
                <th scope="col" className="py-2 text-right text-xs font-medium text-ink-muted">Students</th>
                <th scope="col" className="py-2 pl-4 text-left text-xs font-medium text-ink-muted">Seats filled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bySubject.map((r) => (
                <tr key={r.subject}>
                  <th scope="row" className="py-2 text-left font-normal">{r.subject}</th>
                  <td className="num py-2 text-right">{r.groups}</td>
                  <td className="num py-2 text-right">{r.students}</td>
                  <td className="py-2 pl-4">
                    <RateBar neutral rate={r.capacity ? r.students / r.capacity : null} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  )
}
