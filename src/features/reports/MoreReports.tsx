import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { MonthKey } from '../../types'
import { useSchool } from '../../data/school-context'
import { Panel } from '../../components/ui/Panel'
import { ExportButtons } from '../../components/ui/ExportButtons'
import { RangeToggle } from '../../components/ui/RangeToggle'
import { TableScroll, td, th } from '../../components/ui/misc'
import { monthKey } from '../../lib/dates'
import { formatMonth, formatNumber, formatPercent, formatUZS, formatUZSCompact, listName } from '../../lib/format'
import { expensesByCategory, groupRanking, profitByMonth, retention, studentRanking, teacherPerformance } from '../../lib/reports'
import { cn } from '../../lib/cn'
import { tr } from '../../i18n'

const pct = (x: number | null) => (x === null ? '—' : formatPercent(x))
const score = (x: number | null) => (x === null ? '—' : String(Math.round(x)))

function Stat({ label, value, detail, tone }: { label: string; value: ReactNode; detail?: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={cn('num mt-0.5 text-lg font-semibold', tone === 'bad' ? 'text-danger' : tone === 'good' ? 'text-success' : 'text-ink')}>{value}</p>
      {detail && <p className="text-xs text-ink-muted">{detail}</p>}
    </div>
  )
}

/** Profit, retention, rankings and teacher performance for the chosen period. */
export function MoreReports({ firstMonth, periodKeys, periodLabel, stamp }: { firstMonth: MonthKey; periodKeys: MonthKey[]; periodLabel: string; stamp: string }) {
  const { data, now } = useSchool()
  const [rankBy, setRankBy] = useState<'students' | 'groups'>('students')
  const thisMonth = monthKey(now)

  const profit = profitByMonth(data, periodKeys)
  const totals = profit.reduce((t, m) => ({ revenue: t.revenue + m.revenue, expenses: t.expenses + m.expenses, teacherPay: t.teacherPay + m.teacherPay, profit: t.profit + m.profit }), {
    revenue: 0,
    expenses: 0,
    teacherPay: 0,
    profit: 0,
  })
  const categories = expensesByCategory(data, firstMonth)
  const kept = retention(data, firstMonth)
  const students = studentRanking(data, firstMonth)
  const groups = groupRanking(data, firstMonth)
  const teachers = teacherPerformance(data, firstMonth, thisMonth)
  const groupName = new Map(data.groups.map((g) => [g.id, g.name]))

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <Panel
        id="profit-report"
        className="xl:col-span-2"
        title={tr("Profit and loss")}
        description={tr("{0}. Income received, minus expenses and teacher pay earned.", periodLabel)}
        actions={
          <ExportButtons
            size="sm"
            name="profit"
            date={stamp}
            rows={() => [
              [tr("Month"), tr("Revenue (UZS)"), tr("Expenses (UZS)"), tr("Teacher pay (UZS)"), tr("Profit (UZS)")],
              ...profit.map((m) => [m.key, m.revenue, m.expenses, m.teacherPay, m.profit]),
              [tr("Total"), totals.revenue, totals.expenses, totals.teacherPay, totals.profit],
            ]}
          />
        }
        flush
      >
        <div className="grid grid-cols-2 gap-4 px-5 pb-4 sm:grid-cols-4">
          <Stat label={tr("Revenue")} value={formatUZSCompact(totals.revenue)} />
          <Stat label={tr("Expenses")} value={formatUZSCompact(totals.expenses)} />
          <Stat label={tr("Teacher pay")} value={formatUZSCompact(totals.teacherPay)} />
          <Stat label={tr("Profit")} value={formatUZSCompact(totals.profit)} tone={totals.profit < 0 ? 'bad' : 'good'} />
        </div>
        <TableScroll>
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">{tr("Profit by month")}</caption>
            <thead className="border-y border-line bg-canvas">
              <tr>
                <th scope="col" className={th}>{tr("Month")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Revenue")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Expenses")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Teacher pay")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Profit")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {profit.map((m) => (
                <tr key={m.key}>
                  <th scope="row" className={cn(td, 'text-left font-normal')}>{formatMonth(m.key)}</th>
                  <td className={cn(td, 'num whitespace-nowrap text-right')}>{formatUZS(m.revenue)}</td>
                  <td className={cn(td, 'num whitespace-nowrap text-right')}>{formatUZS(m.expenses)}</td>
                  <td className={cn(td, 'num whitespace-nowrap text-right')}>{formatUZS(m.teacherPay)}</td>
                  <td className={cn(td, 'num whitespace-nowrap text-right font-medium', m.profit < 0 && 'text-danger')}>{formatUZS(m.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        <div className="border-t border-line px-5 py-3 text-sm">
          <p className="mb-2 text-xs font-medium text-ink-muted">{tr("Expenses by category")}</p>
          {categories.length === 0 ? (
            <p className="text-ink-muted">{tr("No expenses recorded in this period.")}</p>
          ) : (
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
              {categories.map((c) => (
                <li key={c.categoryId}>
                  <span className="text-ink-muted">{listName(data.catalogs.expenseCategories, c.categoryId)}</span>{' '}
                  <span className="num font-medium">{formatUZSCompact(c.total)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-muted">
            {tr("Teacher pay is worked out from each teacher’s pay rule (see")}{' '}<Link to="/salaries" className="underline">{tr("Teacher salaries")}</Link>{tr("), so it isn’t entered again as an expense. Refunded and pending payments don’t count as revenue.")}
          </p>
        </div>
      </Panel>

      <Panel
        id="retention-report"
        className="xl:col-span-2"
        title={tr("Retention and leavers")}
        description={tr("{0}, from student status changes.", periodLabel)}
        actions={
          <ExportButtons
            size="sm"
            name="leavers"
            date={stamp}
            rows={() => [[tr("Reason"), tr("Students who left")], ...kept.reasons.map((r) => [r.reason, r.count])]}
          />
        }
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={tr("Kept")} value={pct(kept.rate)} detail={tr("of {0} studying at the start", formatNumber(kept.atStart))} />
          <Stat label={tr("Left")} value={formatNumber(kept.left)} tone={kept.left > 0 ? 'bad' : undefined} />
          <Stat label={tr("Graduated")} value={formatNumber(kept.graduated)} />
          <Stat label={tr("Paused")} value={formatNumber(kept.paused)} />
        </div>
        <h3 className="mt-5 text-xs font-medium text-ink-muted">{tr("Why students left")}</h3>
        {kept.reasons.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">{tr("Nobody left in this period.")}</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {kept.reasons.map((r) => (
              <li key={r.reason} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-ink">{r.reason}</span>
                <span aria-hidden className="h-2 rounded-full bg-danger/70" style={{ width: `${Math.max(6, (r.count / kept.reasons[0].count) * 120)}px` }} />
                <span className="num w-6 text-right font-medium">{r.count}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-ink-muted">{tr("Reasons come from the list in Settings; anything written after the reason is left out here and shown on the student’s history.")}</p>
      </Panel>

      <Panel
        id="ranking-report"
        title={tr("Rankings")}
        description={tr("{0}. Score = average of homework score, test % and attendance %; a part with no data is skipped.", periodLabel)}
        actions={
          <>
            <RangeToggle
              label={tr("Rank")}
              value={rankBy}
              onChange={setRankBy}
              options={[
                { value: 'students', label: tr("Students") },
                { value: 'groups', label: tr("Groups") },
              ]}
            />
            <ExportButtons
              size="sm"
              name={`${rankBy}-ranking`}
              date={stamp}
              rows={() =>
                rankBy === 'students'
                  ? [
                      [tr("Place"), tr("Student"), tr("Group"), tr("Score"), tr("Homework avg"), tr("Homework scored"), tr("Test %"), tr("Tests"), tr("Attendance")],
                      ...students.map((s, i) => [i + 1, s.name, groupName.get(s.groupId ?? '') ?? '', s.score, s.homework === null ? '' : Math.round(s.homework), s.homeworkCount, s.tests === null ? '' : Math.round(s.tests), s.testCount, s.attendance === null ? '' : Math.round(s.attendance * 100) + '%']),
                    ]
                  : [
                      [tr("Place"), tr("Group"), tr("Students"), tr("Score"), tr("Homework avg"), tr("Test %"), tr("Attendance")],
                      ...groups.map((g, i) => [i + 1, g.name, g.students, g.score ?? '', g.homework === null ? '' : Math.round(g.homework), g.tests === null ? '' : Math.round(g.tests), g.attendance === null ? '' : Math.round(g.attendance * 100) + '%']),
                    ]
              }
            />
          </>
        }
        flush
        className="xl:col-span-2"
      >
        <TableScroll>
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">{rankBy === 'students' ? tr("Student ranking") : tr("Group ranking")}{tr(", best first")}</caption>
            <thead className="border-y border-line bg-canvas">
              <tr>
                <th scope="col" className={cn(th, 'w-12 text-right')}>#</th>
                <th scope="col" className={th}>{rankBy === 'students' ? tr("Student") : tr("Group")}</th>
                {rankBy === 'students' ? <th scope="col" className={th}>{tr("Group")}</th> : <th scope="col" className={cn(th, 'text-right')}>{tr("Students")}</th>}
                <th scope="col" className={cn(th, 'text-right')}>{tr("Homework")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Tests")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Attendance")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Score")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rankBy === 'students'
                ? students.slice(0, 15).map((s, i) => (
                    <tr key={s.studentId}>
                      <td className={cn(td, 'num whitespace-nowrap text-right text-ink-muted')}>{i + 1}</td>
                      <th scope="row" className={cn(td, 'text-left font-medium')}>
                        <Link to={`/students/${s.studentId}`} className="hover:underline">
                          {s.name}
                        </Link>
                      </th>
                      <td className={cn(td, 'text-ink-muted')}>{groupName.get(s.groupId ?? '') ?? '—'}</td>
                      <td className={cn(td, 'num whitespace-nowrap text-right')}>{score(s.homework)}</td>
                      <td className={cn(td, 'num whitespace-nowrap text-right')}>{s.tests === null ? '—' : `${Math.round(s.tests)}%`}</td>
                      <td className={cn(td, 'num whitespace-nowrap text-right')}>{pct(s.attendance)}</td>
                      <td className={cn(td, 'num whitespace-nowrap text-right font-semibold')}>{s.score}</td>
                    </tr>
                  ))
                : groups.map((g, i) => (
                    <tr key={g.groupId}>
                      <td className={cn(td, 'num whitespace-nowrap text-right text-ink-muted')}>{g.score === null ? '' : i + 1}</td>
                      <th scope="row" className={cn(td, 'text-left font-medium')}>{g.name}</th>
                      <td className={cn(td, 'num whitespace-nowrap text-right')}>{g.students}</td>
                      <td className={cn(td, 'num whitespace-nowrap text-right')}>{score(g.homework)}</td>
                      <td className={cn(td, 'num whitespace-nowrap text-right')}>{g.tests === null ? '—' : `${Math.round(g.tests)}%`}</td>
                      <td className={cn(td, 'num whitespace-nowrap text-right')}>{pct(g.attendance)}</td>
                      <td className={cn(td, 'num whitespace-nowrap text-right font-semibold')}>{g.score ?? '—'}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </TableScroll>
        {rankBy === 'students' && students.length > 15 && (
          <p className="border-t border-line px-5 py-2.5 text-xs text-ink-muted">{tr("Showing the top 15 of")}{' '}{students.length}{' '}{tr("ranked students. The export includes everyone.")}</p>
        )}
      </Panel>

      <Panel
        id="teacher-report"
        title={tr("Teacher performance")}
        description={tr("{0}. Pay is for {1} so far.", periodLabel, formatMonth(thisMonth))}
        actions={
          <ExportButtons
            size="sm"
            name="teacher-performance"
            date={stamp}
            rows={() => [
              [tr("Teacher"), tr("Groups"), tr("Students"), tr("Attendance"), tr("Homework checked"), tr("Average test %"), tr("Pay {0} (UZS)", thisMonth)],
              ...teachers.map((t) => [t.name, t.groups, t.students, t.attendance === null ? '' : Math.round(t.attendance * 100) + '%', t.homeworkChecked === null ? '' : Math.round(t.homeworkChecked * 100) + '%', t.averageTest === null ? '' : Math.round(t.averageTest), t.pay]),
            ]}
          />
        }
        flush
        className="xl:col-span-2"
      >
        <TableScroll>
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">{tr("Teacher performance")}</caption>
            <thead className="border-y border-line bg-canvas">
              <tr>
                <th scope="col" className={th}>{tr("Teacher")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Groups")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Students")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Attendance")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Homework checked")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Average test")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Pay this month")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {teachers.map((t) => (
                <tr key={t.teacherId}>
                  <th scope="row" className={cn(td, 'text-left font-medium')}>
                    <Link to={`/teachers/${t.teacherId}`} className="hover:underline">
                      {t.name}
                    </Link>
                  </th>
                  <td className={cn(td, 'num whitespace-nowrap text-right')}>{t.groups}</td>
                  <td className={cn(td, 'num whitespace-nowrap text-right')}>{t.students}</td>
                  <td className={cn(td, 'num whitespace-nowrap text-right')}>{pct(t.attendance)}</td>
                  <td className={cn(td, 'num whitespace-nowrap text-right')}>{pct(t.homeworkChecked)}</td>
                  <td className={cn(td, 'num whitespace-nowrap text-right')}>{t.averageTest === null ? '—' : `${Math.round(t.averageTest)}%`}</td>
                  <td className={cn(td, 'num whitespace-nowrap text-right')}>{formatUZS(t.pay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Panel>
    </div>
  )
}
