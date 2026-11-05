import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, UserRoundCheck } from 'lucide-react'
import type { StaffMark } from '../../types'
import { useSchool, type StaffMarkInput } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { Button, IconButton } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Avatar, EmptyState, TableScroll, td, th } from '../../components/ui/misc'
import { ExportButtons } from '../../components/ui/ExportButtons'
import { addDays, isValidISODate, parseISODate, toISODate } from '../../lib/dates'
import { formatDate, formatLongDate, formatPercent } from '../../lib/format'
import { meetsOn } from '../../lib/schedule'
import { roleLabel } from '../../lib/auth'
import { useBranchChoice } from '../../hooks/useBranchChoice'
import { cn } from '../../lib/cn'
import { tr } from '../../i18n'

const MARKS: StaffMark[] = ['present', 'late', 'absent', 'excused']
const markLabel: Record<StaffMark, string> = { present: tr("At work"), late: tr("Late"), absent: tr("Absent"), excused: tr("Excused") }
const markStyle: Record<StaffMark, string> = {
  present: 'peer-checked:bg-success peer-checked:text-white peer-checked:border-success',
  late: 'peer-checked:bg-warning-mark peer-checked:text-ink peer-checked:border-warning-mark',
  absent: 'peer-checked:bg-danger peer-checked:text-white peer-checked:border-danger',
  excused: 'peer-checked:bg-info peer-checked:text-white peer-checked:border-info',
}

interface Person {
  id: string
  type: 'teacher' | 'user'
  name: string
  role: string
  /** Teachers: when their first class starts that day. */
  startsAt?: string
}

/**
 * Who came to work: teachers on the days they teach, and the front office
 * every working day. Quick to fill in: everyone starts as "at work".
 */
export function StaffAttendancePage() {
  const { data, now, branch } = useSchool()
  const needsBranch = useBranchChoice()
  const [params, setParams] = useSearchParams()
  const today = toISODate(now)
  const date = isValidISODate(params.get('date')) ? params.get('date')! : today
  const go = (d: string) => setParams(new URLSearchParams({ date: d }), { replace: true })

  const people = useMemo<Person[]>(() => {
    const teachers = data.teachers
      .filter((t) => t.status === 'active')
      .map((t) => ({ t, first: data.groups.filter((g) => g.teacherId === t.id && meetsOn(g, date)).sort((a, b) => a.startTime.localeCompare(b.startTime))[0] }))
      .filter((x) => x.first)
      .map(({ t, first }) => ({ id: t.id, type: 'teacher' as const, name: t.fullName, role: tr('Teacher · first class {0}', first!.startTime), startsAt: first!.startTime }))
    const staff = data.users
      .filter((u) => (u.role === 'admin' || u.role === 'accountant') && u.active !== false && (!branch || u.branchId === branch.id))
      .map((u) => ({ id: u.id, type: 'user' as const, name: u.fullName, role: roleLabel[u.role] }))
    return [...staff, ...teachers.sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''))]
  }, [data, date, branch])

  return (
    <>
      <PageHeader
        title={tr("Staff attendance")}
        description={tr("Who came to work each day: the front office, and teachers on the days they have classes. Excused = agreed in advance.")}
        actions={
          <ExportButtons
            name={`staff-attendance-${date.slice(0, 7)}`}
            date={today}
            rows={() => {
              const name = new Map([...data.teachers.map((t) => [t.id, t.fullName] as const), ...data.users.map((u) => [u.id, u.fullName] as const)])
              return [
                [tr("Date"), tr("Person"), tr("Mark"), tr("Arrived at"), tr("Note")],
                ...data.staffAttendance
                  .filter((r) => r.date.startsWith(date.slice(0, 7)))
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((r) => [r.date, name.get(r.personId) ?? r.personId, markLabel[r.mark], r.arrivedAt, r.note]),
              ]
            }}
          />
        }
      />
      <div className="mb-4 flex items-center gap-2">
        <IconButton label={tr("Previous day")} onClick={() => go(toISODate(addDays(parseISODate(date), -1)))} className="border border-line-strong bg-surface">
          <ChevronLeft />
        </IconButton>
        <Input type="date" aria-label={tr("Date")} value={date} max={today} onChange={(e) => isValidISODate(e.target.value) && go(e.target.value)} className="w-44" />
        <IconButton label={tr("Next day")} disabled={date >= today} onClick={() => go(toISODate(addDays(parseISODate(date), 1)))} className="border border-line-strong bg-surface disabled:opacity-40">
          <ChevronRight />
        </IconButton>
        <h2 className="ml-2 font-semibold text-ink">{formatLongDate(parseISODate(date))}</h2>
      </div>
      {needsBranch ? (
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState icon={UserRoundCheck} title={tr("Choose a branch")}>
            {needsBranch}
          </EmptyState>
        </div>
      ) : (
        <DaySheet key={`${date}-${branch?.id}`} date={date} people={people} />
      )}
      <MonthSummary date={date} people={people} />
    </>
  )
}

function DaySheet({ date, people }: { date: string; people: Person[] }) {
  const { data, branch, actions } = useSchool()
  const toast = useToast()
  const saved = new Map(data.staffAttendance.filter((r) => r.date === date).map((r) => [r.personId, r]))
  const [rows, setRows] = useState<Record<string, { mark: StaffMark; arrivedAt: string; note: string }>>(() =>
    Object.fromEntries(people.map((p) => [p.id, { mark: saved.get(p.id)?.mark ?? 'present', arrivedAt: saved.get(p.id)?.arrivedAt ?? '', note: saved.get(p.id)?.note ?? '' }])),
  )
  const [dirty, setDirty] = useState(false)
  const setRow = (id: string, patch: Partial<(typeof rows)[string]>) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }))
    setDirty(true)
  }
  if (people.length === 0) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        <EmptyState icon={UserRoundCheck} title={tr("Nobody was due at work")}>
          {tr("No front-office staff on record and no classes on this day.")}
        </EmptyState>
      </div>
    )
  }
  const save = () => {
    const marks: StaffMarkInput[] = people.map((p) => ({
      personId: p.id,
      personType: p.type,
      mark: rows[p.id].mark,
      arrivedAt: rows[p.id].mark === 'present' || rows[p.id].mark === 'late' ? rows[p.id].arrivedAt || undefined : undefined,
      note: rows[p.id].note.trim() || undefined,
    }))
    actions.saveStaffAttendance(branch!.id, date, marks)
    setDirty(false)
    toast.show(tr("Staff attendance saved: {0} of {1} at work.", marks.filter((m) => m.mark === 'present' || m.mark === 'late').length, marks.length))
  }
  const recorded = people.some((p) => saved.has(p.id))

  return (
    <Panel title={tr("Mark the day")} description={recorded ? tr("Saved earlier. Change anything and save again.") : tr("Not saved yet. Everyone starts as at work.")} flush>
      <ul className="divide-y divide-line border-t border-line" aria-label={tr("Staff")}>
        {people.map((p) => {
          const row = rows[p.id]
          return (
            <li key={p.id} className="flex flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center lg:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={p.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                  <p className="truncate text-xs text-ink-muted">{p.role}</p>
                </div>
              </div>
              <fieldset className="flex flex-wrap gap-1.5">
                <legend className="sr-only">{p.name}</legend>
                {MARKS.map((m) => (
                  <label key={m} className="relative">
                    <input type="radio" name={`staff-${p.id}`} checked={row.mark === m} onChange={() => setRow(p.id, { mark: m })} className="peer sr-only" />
                    <span
                      className={cn(
                        'flex h-8 min-w-[4.5rem] cursor-pointer items-center justify-center rounded-control border border-line-strong px-2.5 text-xs font-medium text-ink-muted select-none hover:bg-subtle peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand',
                        markStyle[m],
                      )}
                    >
                      {markLabel[m]}
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="flex gap-2">
                <Input
                  type="time"
                  aria-label={tr("{0} arrived at", p.name)}
                  value={row.arrivedAt}
                  disabled={row.mark === 'absent' || row.mark === 'excused'}
                  onChange={(e) => setRow(p.id, { arrivedAt: e.target.value })}
                  className="h-8 w-28 text-sm"
                />
                <Input aria-label={tr("Note for {0}", p.name)} placeholder={tr("Note")} value={row.note} maxLength={120} onChange={(e) => setRow(p.id, { note: e.target.value })} className="h-8 w-44 text-sm" />
              </div>
            </li>
          )
        })}
      </ul>
      <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-b-panel border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <p className="text-sm text-ink-muted">{dirty ? tr("Unsaved changes.") : recorded ? tr("All saved.") : tr("Not saved yet.")}</p>
        <Button variant="primary" onClick={save} disabled={recorded && !dirty}>
          {recorded ? tr("Update") : tr("Save")}
        </Button>
      </div>
    </Panel>
  )
}

/** This month so far per person: days at work, late and absent. */
function MonthSummary({ date, people }: { date: string; people: Person[] }) {
  const { data } = useSchool()
  const month = date.slice(0, 7)
  const name = new Map([...data.teachers.map((t) => [t.id, t.fullName] as const), ...data.users.map((u) => [u.id, u.fullName] as const)])
  const ids = Array.from(new Set([...people.map((p) => p.id), ...data.staffAttendance.filter((r) => r.date.startsWith(month)).map((r) => r.personId)]))
  const rows = ids
    .map((id) => {
      const recs = data.staffAttendance.filter((r) => r.personId === id && r.date.startsWith(month))
      const count = (m: StaffMark) => recs.filter((r) => r.mark === m).length
      const counted = recs.filter((r) => r.mark !== 'excused').length
      return { id, name: name.get(id) ?? id, present: count('present'), late: count('late'), absent: count('absent'), excused: count('excused'), rate: counted ? (count('present') + count('late')) / counted : null, last: recs.sort((a, b) => b.date.localeCompare(a.date))[0] }
    })
    .filter((r) => r.last)
    .sort((a, b) => a.name.localeCompare(b.name))
  if (rows.length === 0) return null
  return (
    <Panel title={tr("This month")} description={tr("Days recorded so far.")} className="mt-6" flush>
      <TableScroll>
        <table className="w-full min-w-[620px] text-sm">
          <thead className="border-y border-line bg-canvas">
            <tr>
              <th scope="col" className={th}>{tr("Person")}</th>
              <th scope="col" className={cn(th, 'text-right')}>{tr("At work")}</th>
              <th scope="col" className={cn(th, 'text-right')}>{tr("Late")}</th>
              <th scope="col" className={cn(th, 'text-right')}>{tr("Absent")}</th>
              <th scope="col" className={cn(th, 'text-right')}>{tr("Excused")}</th>
              <th scope="col" className={cn(th, 'text-right')}>{tr("Attendance")}</th>
              <th scope="col" className={th}>{tr("Last recorded")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cn(td, 'font-medium text-ink')}>{r.name}</td>
                <td className={cn(td, 'num text-right')}>{r.present}</td>
                <td className={cn(td, 'num text-right', r.late > 0 && 'text-warning')}>{r.late}</td>
                <td className={cn(td, 'num text-right', r.absent > 0 && 'text-danger')}>{r.absent}</td>
                <td className={cn(td, 'num text-right text-ink-muted')}>{r.excused}</td>
                <td className={cn(td, 'num text-right')}>{r.rate === null ? '—' : formatPercent(r.rate)}</td>
                <td className={cn(td, 'num text-ink-muted')}>{r.last ? formatDate(r.last.date) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Panel>
  )
}
