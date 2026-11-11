import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  ArrowRight,
  CalendarDays,
  CalendarX2,
  ChevronRight,
  CircleCheck,
  Database,
  GraduationCap,
  Lightbulb,
  Megaphone,
  Minus,
  Phone,
  TrendingDown,
  TrendingUp,
  UserRoundX,
  UserX,
  Wallet,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { Panel } from '../../components/ui/Panel'
import { ButtonLink } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { EmptyState, TableScroll, td, th } from '../../components/ui/misc'
import { addMonths, monthKey, monthRange } from '../../lib/dates'
import { formatLongDate, formatMonth, formatNumber, formatPercent, formatUZSCompact, greeting } from '../../lib/format'
import { branchData } from '../../lib/owner'
import { financeByMonth, isEmpty, ownerAttention, ownerInsights, ownerMonth, type BranchMonth, type Insight, type OwnerAttention, type OwnerMonth } from '../../lib/owner-dashboard'
import { cn } from '../../lib/cn'
import { OwnerFinanceChart } from './OwnerFinanceChart'
import { tr } from '../../i18n'

const ALL = 'all'

/**
 * The owner's first screen. Top to bottom: the four headline numbers, what
 * they mean, what needs acting on, money over 12 months, enquiries, and the
 * branches side by side. Filters: month and branch. Every number is worked
 * out from stored records (lib/owner-dashboard); where records don't exist
 * yet the page says so and never shows a made-up figure.
 */
export function OwnerOverviewPage() {
  const { owner, now } = useSchool()
  const navigate = useNavigate()
  const all = owner!.data
  const thisMonth = monthKey(now)
  const [month, setMonth] = useState(thisMonth)
  // The branch filter is the same one as the switcher in the header, so the two can never disagree
  // and the branch pages opened from here stay on the chosen branch.
  const branch = all.branches.find((b) => b.id === owner!.branchId)
  const months = useMemo(() => monthRange(addMonths(thisMonth, -11), thisMonth).reverse(), [thisMonth])

  const scoped = useMemo(() => (branch ? branchData(all, branch.id) : all), [all, branch])
  const current = useMemo(() => ownerMonth(scoped, month, now), [scoped, month, now])
  const previous = useMemo(() => ownerMonth(scoped, addMonths(month, -1), now), [scoped, month, now])
  const branches: BranchMonth[] = useMemo(() => all.branches.map((b) => ({ id: b.id, name: b.name, m: ownerMonth(branchData(all, b.id), month, now) })), [all, month, now])
  const insights = useMemo(() => ownerInsights({ data: scoped, current, previous, branches: branch ? [] : branches, now }), [scoped, current, previous, branches, branch, now])
  const attention = useMemo(() => ownerAttention(scoped, current, now), [scoped, current, now])
  const finance = useMemo(() => financeByMonth(scoped, now), [scoped, now])

  // The branch pages follow the dashboard's branch filter.
  const open = (path: string, toBranch: string | null = branch?.id ?? null) => {
    owner!.setBranch(toBranch)
    navigate(path)
  }
  const isThisMonth = month === thisMonth
  const monthName = formatMonth(month)

  return (
    <div className="space-y-6 pb-16">
      {/* Header and filters */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink">
            {greeting(now)}
            {tr(", Mr. Sherzod")}
          </h1>
          <p className="mt-1 text-ink-muted">
            {all.settings.centerName} · {branch ? tr("{0} branch", branch.name) : tr("All {0} branches", all.branches.length)} · {formatLongDate(now)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label={tr("Month")} value={month} onChange={(e) => setMonth(e.target.value)} className="w-60">
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
                {m === thisMonth ? tr(" (this month)") : ''}
              </option>
            ))}
          </Select>
          <Select aria-label={tr("Branch")} value={branch ? branch.id : ALL} onChange={(e) => owner!.setBranch(e.target.value === ALL ? null : e.target.value)} className="w-44">
            <option value={ALL}>{tr("All branches")}</option>
            {all.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <ButtonLink to="/schedule" variant="ghost">
            <CalendarDays aria-hidden />
            {tr("Timetable")}
          </ButtonLink>
        </div>
      </div>

      {isEmpty(current) && (
        <div className="flex items-start gap-3 rounded-panel border border-line bg-surface px-5 py-4">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-muted">
            <Database className="size-4" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-medium text-ink">{branch ? tr("{0} has no school data yet", branch.name) : tr("There is no school data yet")}</p>
            <p className="mt-0.5 text-ink-muted">{tr("This page fills in by itself as students, payments, attendance and enquiries are recorded. Until then it shows “no data” instead of zeros.")}</p>
          </div>
        </div>
      )}

      {/* 1. Headline numbers */}
      <section aria-label={tr("Key figures")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          icon={GraduationCap}
          label={tr("Students")}
          onOpen={() => open('/students?status=active')}
          value={current.has.students ? formatNumber(current.activeStudents) : null}
          caption={current.has.students ? tr("active today · changes in {0}", monthName) : tr("No students recorded yet")}
        >
          {current.has.students && (
            <Facts
              rows={[
                [tr("Joined"), <Signed key="j" value={current.joined} sign="+" />],
                [tr("Left"), <Signed key="l" value={current.left} sign="−" />],
                [tr("Net change"), <Net key="n" value={current.net} />],
              ]}
            />
          )}
        </Tile>

        <Tile
          icon={Wallet}
          label={tr("Money")}
          onOpen={() => navigate('/owner/finance')}
          value={current.has.payments ? formatUZSCompact(current.collected) : null}
          caption={current.has.payments ? tr("collected in {0}", monthName) : tr("No payments recorded yet")}
        >
          {current.has.payments && (
            <Facts
              rows={[
                [tr("Payments received"), formatNumber(current.payments)],
                [tr("% of expected"), <Unavailable key="u" title={tr("Expected tuition needs the billing rules, which are not set up yet.")} />],
              ]}
            />
          )}
        </Tile>

        <Tile
          icon={WalletCards}
          label={tr("Debt")}
          onOpen={() => open('/payments?view=owing')}
          value={current.has.students ? formatUZSCompact(current.overdue) : null}
          tone={current.overdue > 0 ? 'danger' : undefined}
          caption={current.has.students ? tr("overdue today") : tr("No students recorded yet")}
        >
          {current.has.students && (
            <Facts
              rows={[
                [tr("Students overdue"), formatNumber(current.overdueStudents)],
                [tr("Outstanding"), formatUZSCompact(current.outstanding)],
                [tr("Students who owe"), formatNumber(current.owingStudents)],
              ]}
            />
          )}
        </Tile>

        <Tile
          icon={Megaphone}
          label={tr("Enquiries")}
          onOpen={() => open('/leads')}
          value={current.has.leads ? formatNumber(current.leads.enquiries) : null}
          caption={current.has.leads ? tr("received in {0}", monthName) : tr("No enquiries recorded yet")}
        >
          {current.has.leads && (
            <Facts
              rows={[
                [tr("Enrolled"), formatNumber(current.leads.enrolled)],
                [tr("Started studying"), formatNumber(current.leads.started)],
              ]}
            />
          )}
        </Tile>
      </section>

      {/* 2. What this means + 3. Needs attention */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel id="owner-insights" title={tr("What this means")} description={isThisMonth ? tr("{0} so far, from the recorded data", monthName) : tr("{0}, from the recorded data", monthName)} className="xl:col-span-2">
          <InsightList items={insights} />
        </Panel>
        <Panel id="owner-attention" title={tr("Needs attention")} flush>
          <AttentionList items={attention} onOpen={(to) => open(to)} />
        </Panel>
      </div>

      {/* 4. Money over 12 months + 5. Enquiries */}
      <div className="grid gap-6 xl:grid-cols-3">
        <OwnerFinanceChart rows={finance.rows} hasAny={finance.hasAny} monthsWithoutCosts={finance.monthsWithoutCosts} className="xl:col-span-2" />
        <LeadPerformance m={current} monthName={monthName} inProgress={isThisMonth} />
      </div>

      {/* 6. Branches side by side */}
      <Panel id="owner-branches" title={tr("Branches side by side")} description={tr("{0}. Click a branch to work in it.", monthName)} flush>
        <BranchTable rows={branches} selected={branch?.id} onOpen={(id) => open('/', id)} />
      </Panel>
    </div>
  )
}

// ---------------------------------------------------------------- headline tiles

function Tile({ icon: Icon, label, value, caption, tone, onOpen, children }: { icon: LucideIcon; label: string; value: string | null; caption: string; tone?: 'danger'; onOpen: () => void; children?: ReactNode }) {
  return (
    <article className="flex min-w-0 flex-col rounded-panel border border-line bg-surface">
      <button type="button" onClick={onOpen} className="group flex flex-col items-start rounded-t-panel px-5 pt-5 pb-4 text-left hover:bg-canvas/60 focus-visible:-outline-offset-2">
        <span className="flex w-full items-center gap-2.5 text-sm font-medium text-ink-muted">
          <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
            <Icon className="size-4" />
          </span>
          {label}
          <ChevronRight aria-hidden className="ml-auto size-4 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </span>
        <span className={cn('num mt-4 text-[2rem] leading-none font-semibold tracking-[-0.02em]', value === null ? 'text-ink-faint' : tone === 'danger' ? 'text-danger' : 'text-ink')}>{value ?? '—'}</span>
        <span className="mt-1.5 text-sm text-ink-muted">{caption}</span>
      </button>
      {children && <div className="mt-auto border-t border-line px-5 py-3">{children}</div>}
    </article>
  )
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3">
          <dt className="min-w-0 truncate text-ink-muted">{label}</dt>
          <dd className="num shrink-0 font-medium text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** +9 in green, −4 plainly (a fall is worth noticing, not an alarm), 0 as is. */
function Net({ value }: { value: number }) {
  if (value > 0) return <span className="text-success">+{value}</span>
  if (value < 0) return <span>−{-value}</span>
  return <span>0</span>
}

/** "+4" or "−2"; a plain 0 when nothing changed. */
function Signed({ value, sign }: { value: number; sign: '+' | '−' }) {
  return <>{value === 0 ? '0' : `${sign}${value}`}</>
}

function Unavailable({ title }: { title: string }) {
  return (
    <span title={title} className="rounded-full bg-subtle px-2 py-0.5 text-xs font-normal text-ink-muted">
      {tr("Not available yet")}
    </span>
  )
}

// ---------------------------------------------------------------- what this means

const INSIGHT_STYLE: Record<Insight['tone'], { icon: LucideIcon; tint: string }> = {
  good: { icon: TrendingUp, tint: 'bg-success-soft text-success' },
  watch: { icon: TrendingDown, tint: 'bg-warning-soft text-warning' },
  neutral: { icon: Minus, tint: 'bg-subtle text-ink-muted' },
}

function InsightList({ items }: { items: Insight[] }) {
  if (items.length === 0) {
    return (
      <EmptyState icon={Lightbulb} title={tr("Nothing to conclude yet")}>
        {tr("Short conclusions appear here once there is enough recorded data to support them. Nothing is guessed.")}
      </EmptyState>
    )
  }
  return (
    <ul className="space-y-3">
      {items.map((i) => {
        const { icon: Icon, tint } = INSIGHT_STYLE[i.tone]
        return (
          <li key={i.key} className="flex items-start gap-3">
            <span aria-hidden className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full', tint)}>
              <Icon className="size-3.5" />
            </span>
            <p className="min-w-0 text-[0.9375rem] leading-relaxed text-ink">{i.text}</p>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- needs attention

const ATTENTION_ICON: Record<OwnerAttention['key'], LucideIcon> = {
  attendance: CalendarX2,
  overdue: Wallet,
  waiting: Phone,
  'not-started': UserRoundX,
  absences: UserX,
}

function AttentionList({ items, onOpen }: { items: OwnerAttention[]; onOpen: (to: string) => void }) {
  if (items.length === 0) {
    return (
      <EmptyState icon={CircleCheck} title={tr("All clear")}>
        {tr("No missed attendance, overdue tuition or waiting enquiries right now.")}
      </EmptyState>
    )
  }
  return (
    <ul className="divide-y divide-line border-t border-line">
      {items.map((i) => {
        const Icon = ATTENTION_ICON[i.key]
        return (
          <li key={i.key}>
            <button type="button" onClick={() => onOpen(i.to)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-canvas focus-visible:-outline-offset-2">
              <span aria-hidden className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', i.tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning')}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{i.label}</span>
                <span className="block text-xs text-ink-muted">{i.detail}</span>
              </span>
              <span className="num text-lg font-semibold text-ink">{i.count}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-faint" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- lead performance

function LeadPerformance({ m, monthName, inProgress }: { m: OwnerMonth; monthName: string; inProgress: boolean }) {
  const { enquiries, enrolled, started, enrolledNotStarted } = m.leads
  const steps: [string, number, string][] = [
    [tr("Enquiries"), enquiries, 'bg-brand'],
    [tr("Enrolled"), enrolled, 'bg-brand'],
    [tr("Started studying"), started, 'bg-brand'],
  ]
  return (
    <Panel
      id="owner-leads"
      title={tr("Enquiries to students")}
      description={inProgress ? tr("Enquiries received in {0} (month still in progress)", monthName) : tr("Enquiries received in {0}", monthName)}
      actions={
        <Link to="/owner/leads" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
          {tr("Lead analytics")}
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      }
    >
      {!m.has.leads ? (
        <EmptyState icon={Megaphone} title={tr("No enquiries recorded yet")}>
          {tr("Once enquiries are added in Admissions, this shows how many enrol and how many actually start.")}
        </EmptyState>
      ) : enquiries === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">{tr("No enquiries were received in {0}.", monthName)}</p>
      ) : (
        <>
          <ol className="space-y-4">
            {steps.map(([label, n, bar]) => (
              <li key={label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink-muted">{label}</span>
                  <span className="num font-semibold text-ink">
                    {formatNumber(n)}
                    {label !== steps[0][0] && <span className="ml-1.5 text-xs font-normal text-ink-muted">{formatPercent(n / enquiries)}</span>}
                  </span>
                </div>
                <div aria-hidden className="mt-1.5 h-2 rounded-full bg-subtle">
                  <div className={cn('h-2 rounded-full', bar)} style={{ width: `${Math.max(n > 0 ? 3 : 0, (n / enquiries) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex items-center justify-between gap-3 rounded-control bg-subtle px-3 py-2.5 text-sm">
            <span className="text-ink-muted">{tr("Enrolled but not started")}</span>
            <span className={cn('num font-semibold', enrolledNotStarted > 0 ? 'text-warning' : 'text-ink')}>{formatNumber(enrolledNotStarted)}</span>
          </div>
          <p className="mt-3 text-xs text-ink-muted">{tr("“Started” means the student attended at least one class. Enrolling alone doesn’t count.")}</p>
        </>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------- branch comparison

function BranchTable({ rows, selected, onOpen }: { rows: BranchMonth[]; selected?: string; onOpen: (branchId: string) => void }) {
  const withData = rows.filter((r) => !isEmpty(r.m))
  // Mark the weakest value in a column only when there is something to compare it with.
  const worstOverdue = withData.length > 1 ? Math.max(...withData.map((r) => r.m.overdue)) : 0
  const rates = withData.map((r) => r.m.attendanceRate).filter((v): v is number => v !== null)
  const worstAttendance = rates.length > 1 && Math.max(...rates) - Math.min(...rates) >= 0.05 ? Math.min(...rates) : null
  const sum = (pick: (m: OwnerMonth) => number) => rows.reduce((total, r) => total + pick(r.m), 0)
  const right = cn(th, 'text-right')
  const cell = cn(td, 'num text-right whitespace-nowrap')

  return (
    <TableScroll>
      <table className="w-full min-w-[1040px] text-sm">
        <caption className="sr-only">{tr("Branch comparison")}</caption>
        <thead className="border-y border-line bg-canvas">
          <tr>
            <th scope="col" className={th}>{tr("Branch")}</th>
            <th scope="col" className={right}>{tr("Students")}</th>
            <th scope="col" className={right}>{tr("Joined")}</th>
            <th scope="col" className={right}>{tr("Left")}</th>
            <th scope="col" className={right}>{tr("Net change")}</th>
            <th scope="col" className={right}>{tr("Collected")}</th>
            <th scope="col" className={right}>{tr("Overdue")}</th>
            <th scope="col" className={right}>{tr("Attendance")}</th>
            <th scope="col" className={right}>{tr("Enquiries")}</th>
            <th scope="col" className={right}>{tr("Enrolled")}</th>
            <th scope="col" className={right}>{tr("Started")}</th>
            <th scope="col" className={th}><span className="sr-only">{tr("Open")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(({ id, name, m }) => {
            const empty = isEmpty(m)
            const dash = <span className="text-ink-faint">—</span>
            return (
              <tr key={id} onClick={() => onOpen(id)} className={cn('cursor-pointer hover:bg-canvas/70', id === selected && 'bg-brand-soft/40')}>
                <th scope="row" className={cn(td, 'text-left font-normal')}>
                  <span className="block font-medium text-ink">{name}</span>
                  {empty && <span className="mt-0.5 inline-block rounded-full bg-subtle px-2 py-0.5 text-xs text-ink-muted">{tr("No data yet")}</span>}
                </th>
                <td className={cell}>{m.has.students ? formatNumber(m.activeStudents) : dash}</td>
                <td className={cell}>{m.has.students ? <Signed value={m.joined} sign="+" /> : dash}</td>
                <td className={cell}>{m.has.students ? <Signed value={m.left} sign="−" /> : dash}</td>
                <td className={cell}>{m.has.students ? <Net value={m.net} /> : dash}</td>
                <td className={cell}>{m.has.payments ? formatUZSCompact(m.collected) : dash}</td>
                <td className={cn(cell, m.overdue > 0 && m.overdue === worstOverdue && 'font-medium text-danger')}>{m.has.students ? formatUZSCompact(m.overdue) : dash}</td>
                <td className={cn(cell, m.attendanceRate !== null && m.attendanceRate === worstAttendance && 'text-warning')}>{m.attendanceRate === null ? dash : formatPercent(m.attendanceRate)}</td>
                <td className={cell}>{m.has.leads ? formatNumber(m.leads.enquiries) : dash}</td>
                <td className={cell}>{m.has.leads ? formatNumber(m.leads.enrolled) : dash}</td>
                <td className={cell}>{m.has.leads ? formatNumber(m.leads.started) : dash}</td>
                <td className={cn(td, 'text-right')}>
                  <ArrowRight aria-hidden className="ml-auto size-4 text-ink-faint" />
                </td>
              </tr>
            )
          })}
        </tbody>
        {withData.length > 1 && (
          <tfoot className="border-t border-line-strong bg-canvas/60 font-medium">
            <tr>
              <th scope="row" className={cn(td, 'text-left')}>{tr("All branches")}</th>
              <td className={cell}>{formatNumber(sum((m) => m.activeStudents))}</td>
              <td className={cell}><Signed value={sum((m) => m.joined)} sign="+" /></td>
              <td className={cell}><Signed value={sum((m) => m.left)} sign="−" /></td>
              <td className={cell}><Net value={sum((m) => m.net)} /></td>
              <td className={cell}>{formatUZSCompact(sum((m) => m.collected))}</td>
              <td className={cell}>{formatUZSCompact(sum((m) => m.overdue))}</td>
              <td className={cell} />
              <td className={cell}>{formatNumber(sum((m) => m.leads.enquiries))}</td>
              <td className={cell}>{formatNumber(sum((m) => m.leads.enrolled))}</td>
              <td className={cell}>{formatNumber(sum((m) => m.leads.started))}</td>
              <td className={td} />
            </tr>
          </tfoot>
        )}
      </table>
    </TableScroll>
  )
}
