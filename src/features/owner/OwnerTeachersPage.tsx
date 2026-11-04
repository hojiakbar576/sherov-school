import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRightLeft, Gift, Trash2, Trophy } from 'lucide-react'
import type { Teacher } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { Button, IconButton } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { RangeToggle } from '../../components/ui/RangeToggle'
import { Badge } from '../../components/ui/Badge'
import { TableScroll, td, th } from '../../components/ui/misc'
import { TeacherStatusBadge } from '../../components/StatusBadges'
import { addMonths, isValidISODate, monthKey, toISODate } from '../../lib/dates'
import { formatDate, formatMonth, formatPercent, formatUZS } from '../../lib/format'
import { BONUS_PLACES, RATING_PART_LABEL, RATING_PARTS, RATING_WEIGHTS, teacherRatings } from '../../lib/rating'
import { enrolmentByGroup } from '../../lib/metrics'
import { cn } from '../../lib/cn'

/**
 * Every teacher across the branches: the monthly rating (with bonuses for
 * the top places) and the teacher list, where the owner can move someone to
 * another branch.
 */
export function OwnerTeachersPage() {
  const { owner, now } = useSchool()
  const data = owner!.data
  const [which, setWhich] = useState<'this' | 'last'>('last')
  const [branchFilter, setBranchFilter] = useState('')
  const [moving, setMoving] = useState<Teacher | null>(null)
  const [awarding, setAwarding] = useState<{ teacherId: string; place: number } | null>(null)
  const month = which === 'this' ? monthKey(now) : addMonths(monthKey(now), -1)
  const ratings = useMemo(() => teacherRatings(data, month, now), [data, month, now])
  const branchName = new Map(data.branches.map((b) => [b.id, b.name]))
  const teacherBranch = new Map(data.teachers.map((t) => [t.id, t.branchId]))
  const enrolment = enrolmentByGroup(data)
  const teachers = data.teachers.filter((t) => !branchFilter || t.branchId === branchFilter).sort((a, b) => (branchName.get(a.branchId) ?? '').localeCompare(branchName.get(b.branchId) ?? '') || a.fullName.localeCompare(b.fullName))

  return (
    <>
      <PageHeader title="Teachers & rating" description="Who is putting in the work each month, bonuses, and which branch each teacher works at." />

      <Panel
        title={`Rating for ${formatMonth(month)}`}
        description={`Out of 100, from what teachers do day to day: ${RATING_PARTS.map((p) => `${RATING_PART_LABEL[p].title.toLowerCase()} (${RATING_WEIGHTS[p]})`).join(', ')}. How high their grades are doesn’t count. The top ${BONUS_PLACES} can get a bonus.`}
        actions={
          <RangeToggle
            label="Month"
            value={which}
            onChange={setWhich}
            options={[
              { value: 'last', label: 'Last month' },
              { value: 'this', label: 'This month so far' },
            ]}
          />
        }
        flush
      >
        <TableScroll>
          <table className="w-full min-w-[820px] text-sm">
            <caption className="sr-only">Teacher rating for {formatMonth(month)}</caption>
            <thead className="border-y border-line bg-canvas">
              <tr>
                <th scope="col" className={cn(th, 'w-14')}>Place</th>
                <th scope="col" className={th}>Teacher</th>
                <th scope="col" className={cn(th, 'text-right')}>Score</th>
                {RATING_PARTS.map((p) => (
                  <th key={p} scope="col" className={cn(th, 'hidden text-right lg:table-cell')} title={RATING_PART_LABEL[p].detail}>
                    {RATING_PART_LABEL[p].title}
                  </th>
                ))}
                <th scope="col" className={cn(th, 'text-right')}>Bonus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ratings.map((r) => {
                const bonuses = data.bonuses.filter((b) => b.teacherId === r.teacherId && b.month === month)
                const inBonus = r.rank <= BONUS_PLACES
                return (
                  <tr key={r.teacherId} className={cn(inBonus && 'bg-brand-soft/30')}>
                    <td className={cn(td, 'num font-semibold')}>
                      {inBonus ? (
                        <span className="inline-flex items-center gap-1 text-brand-ink">
                          <Trophy aria-hidden className="size-3.5" />
                          {r.rank}
                        </span>
                      ) : (
                        <span className="text-ink-muted">{r.rank}</span>
                      )}
                    </td>
                    <td className={td}>
                      <span className="block font-medium text-ink">{r.teacherName}</span>
                      <span className="block text-xs text-ink-muted">{branchName.get(teacherBranch.get(r.teacherId) ?? '')}</span>
                    </td>
                    <td className={cn(td, 'num text-right text-base font-semibold text-ink')}>{r.score}</td>
                    {RATING_PARTS.map((p) => (
                      <td key={p} className={cn(td, 'num hidden text-right text-ink-muted lg:table-cell')}>
                        {r.parts[p] === null ? '—' : formatPercent(r.parts[p]!)}
                      </td>
                    ))}
                    <td className={cn(td, 'text-right')}>
                      {bonuses.length ? (
                        <span className="inline-flex items-center gap-1">
                          <Badge tone="success">{formatUZS(bonuses.reduce((s, b) => s + b.amount, 0))}</Badge>
                          {bonuses.map((b) => (
                            <BonusDelete key={b.id} id={b.id} />
                          ))}
                        </span>
                      ) : (
                        <Button size="sm" variant={inBonus ? 'secondary' : 'ghost'} onClick={() => setAwarding({ teacherId: r.teacherId, place: r.rank })}>
                          <Gift aria-hidden />
                          Award
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableScroll>
        {ratings.length === 0 && <p className="px-5 py-4 text-sm text-ink-muted">No teacher had running groups this month.</p>}
      </Panel>

      <Panel
        title="All teachers"
        description="Only you can move a teacher to another branch. Their history stays with them."
        className="mt-6"
        actions={
          <Select aria-label="Filter by branch" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="h-9 w-44">
            <option value="">All branches</option>
            {data.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        }
        flush
      >
        <TableScroll>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-y border-line bg-canvas">
              <tr>
                <th scope="col" className={th}>Teacher</th>
                <th scope="col" className={th}>Branch</th>
                <th scope="col" className={cn(th, 'text-right')}>Groups</th>
                <th scope="col" className={cn(th, 'text-right')}>Students</th>
                <th scope="col" className={cn(th, 'text-right')}>Pay share</th>
                <th scope="col" className={th}>Status</th>
                <th scope="col" className={th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {teachers.map((t) => {
                const groups = data.groups.filter((g) => g.teacherId === t.id && g.status === 'active')
                const history = t.branchHistory ?? []
                return (
                  <tr key={t.id}>
                    <td className={td}>
                      <Link
                        to={`/teachers/${t.id}`}
                        onClick={() => owner!.setBranch(t.branchId)}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {t.fullName}
                      </Link>
                      <span className="block text-xs text-ink-muted">{t.subject}</span>
                    </td>
                    <td className={td}>
                      {branchName.get(t.branchId)}
                      {history.length > 1 && <span className="block text-xs text-ink-muted">since {formatDate(history[history.length - 1].from)}</span>}
                    </td>
                    <td className={cn(td, 'num text-right')}>{groups.length}</td>
                    <td className={cn(td, 'num text-right')}>{groups.reduce((s, g) => s + (enrolment.get(g.id) ?? 0), 0)}</td>
                    <td className={cn(td, 'num text-right text-ink-muted')}>{t.salaryPercent}%</td>
                    <td className={td}>
                      <TeacherStatusBadge status={t.status} />
                    </td>
                    <td className={cn(td, 'text-right')}>
                      <Button size="sm" variant="ghost" onClick={() => setMoving(t)}>
                        <ArrowRightLeft aria-hidden />
                        Move
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableScroll>
      </Panel>

      <MoveTeacherDialog teacher={moving} onClose={() => setMoving(null)} />
      <BonusDialog award={awarding} month={month} onClose={() => setAwarding(null)} />
    </>
  )
}

function BonusDelete({ id }: { id: string }) {
  const { actions } = useSchool()
  const toast = useToast()
  return (
    <IconButton
      label="Remove this bonus"
      onClick={() => {
        actions.deleteBonus(id)
        toast.show('Bonus removed.')
      }}
      className="size-7 hover:bg-danger-soft hover:text-danger"
    >
      <Trash2 />
    </IconButton>
  )
}

// ---------------------------------------------------------------- move teacher

function MoveTeacherDialog({ teacher, onClose }: { teacher: Teacher | null; onClose: () => void }) {
  return (
    <Dialog open={teacher !== null} onClose={onClose} title="Move to another branch" description={teacher ? `${teacher.fullName}. Their history and past pay stay on record.` : undefined}>
      {teacher && <MoveTeacherForm teacher={teacher} onClose={onClose} />}
    </Dialog>
  )
}

function MoveTeacherForm({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  const { owner, now, actions } = useSchool()
  const toast = useToast()
  const data = owner!.data
  const others = data.branches.filter((b) => b.id !== teacher.branchId)
  const [to, setTo] = useState(others[0]?.id ?? '')
  const [on, setOn] = useState(toISODate(now))
  const [error, setError] = useState('')
  const groups = data.groups.filter((g) => g.teacherId === teacher.id && g.status !== 'completed')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!isValidISODate(on)) return setError('Choose the date of the move.')
    const result = actions.transferTeacher(teacher.id, to, on)
    if (!result.ok) return setError(result.reason)
    toast.show(`${teacher.fullName} now works at ${data.branches.find((b) => b.id === to)?.name}.`)
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="rounded-control bg-subtle px-3 py-2 text-sm text-ink-muted">
        Now at <span className="font-medium text-ink">{data.branches.find((b) => b.id === teacher.branchId)?.name}</span>.
        {groups.length > 0 && (
          <>
            {' '}
            Still teaches {groups.map((g) => g.name).join(', ')}. A group stays at its branch, so give these groups another teacher first.
          </>
        )}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New branch">
          {(p) => (
            <Select {...p} value={to} onChange={(e) => setTo(e.target.value)}>
              {others.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="From" error={error || undefined}>
          {(p) => <Input {...p} type="date" value={on} onChange={(e) => setOn(e.target.value)} />}
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={groups.length > 0}>
          Move teacher
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------- bonus

function BonusDialog({ award, month, onClose }: { award: { teacherId: string; place: number } | null; month: string; onClose: () => void }) {
  const { owner } = useSchool()
  const teacher = owner?.data.teachers.find((t) => t.id === award?.teacherId)
  return (
    <Dialog open={award !== null} onClose={onClose} title="Award a bonus" description={teacher ? `${teacher.fullName}, ${formatMonth(month)}. Place ${award?.place} in the rating.` : undefined} size="sm">
      {award && <BonusForm award={award} month={month} onClose={onClose} />}
    </Dialog>
  )
}

function BonusForm({ award, month, onClose }: { award: { teacherId: string; place: number }; month: string; onClose: () => void }) {
  const { actions } = useSchool()
  const toast = useToast()
  const [amount, setAmount] = useState(String(award.place === 1 ? 1_000_000 : award.place === 2 ? 700_000 : 500_000))
  const [note, setNote] = useState(award.place <= BONUS_PLACES ? `Rating place ${award.place}` : '')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return setError('Enter the amount in UZS.')
    actions.awardBonus({ teacherId: award.teacherId, month, place: award.place, amount: Math.round(n), note: note.trim() || undefined })
    toast.show(`Bonus of ${formatUZS(Math.round(n))} recorded.`)
    onClose()
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Amount (UZS)" error={error || undefined} hint="Recorded here only; paying it out happens outside the app.">
        {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={50000} value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </Field>
      <Field label="Note" optional>
        {(p) => <Input {...p} value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          Award bonus
        </Button>
      </div>
    </form>
  )
}
