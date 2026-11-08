import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Banknote, ChevronLeft, History, Pencil, UsersRound, Wallet } from 'lucide-react'
import type { Student } from '../../types'
import { useSchool } from '../../data/school-context'
import { ButtonLink, IconButton } from '../../components/ui/Button'
import { EmptyState, TableScroll, td, th } from '../../components/ui/misc'
import { GroupStatusBadge, TuitionBadge } from '../../components/StatusBadges'
import { PhoneLine } from '../../components/ui/CopyButton'
import { formatDate, formatMonthShort, formatUZS, groupDaysLabel } from '../../lib/format'
import { endTime } from '../../lib/schedule'
import { levelOf } from '../../lib/courses'
import { cn } from '../../lib/cn'
import { GroupFormDialog } from './GroupFormDialog'
import { AttendanceJournal } from './AttendanceJournal'
import { PaymentFormDialog } from '../payments/PaymentFormDialog'
import { tr } from '../../i18n'
import { inGroup } from '../../lib/membership'

const TABS = ['attendance', 'payments', 'history'] as const
type Tab = (typeof TABS)[number]

/** Why a student's dot has its colour. Owing money comes first: that's what the front desk acts on. */
type Dot = 'owes' | 'paused' | 'ok'
const DOT_CLASS: Record<Dot, string> = { owes: 'bg-danger-mark', paused: 'bg-warning-mark', ok: 'bg-success' }

/**
 * One group, LC UP style: a card with everything about the group on the left
 * (students who owe money in red), and its journal on the right.
 */
export function GroupDetailPage() {
  const { groupId } = useParams()
  const { data, balances } = useSchool()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState<string | null>(null)
  const group = data.groups.find((g) => g.id === groupId)

  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'attendance') as Tab
  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )

  const records = useMemo(() => data.attendance.filter((r) => r.groupId === groupId).sort((a, b) => a.date.localeCompare(b.date)), [data.attendance, groupId])

  // The group's students today.
  const current = useMemo(
    () => data.students.filter((s) => inGroup(s, groupId) && (s.status === 'active' || s.status === 'paused')).sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [data.students, groupId],
  )

  if (!group) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        <EmptyState icon={UsersRound} title={tr("Group not found")} action={<ButtonLink to="/groups">{tr("Back to groups")}</ButtonLink>}>
          {tr("It may have been deleted, or it belongs to another branch.")}
        </EmptyState>
      </div>
    )
  }

  const teacher = data.teachers.find((t) => t.id === group.teacherId)
  const branchName = data.branches.find((b) => b.id === group.branchId)?.name
  const { course, level } = levelOf(data.courses, group)
  const dotFor = (s: Student): Dot => {
    const b = balances.get(s.id)
    if (b && b.owed > 0 && (b.status === 'due' || b.status === 'overdue')) return 'owes'
    return s.status === 'paused' ? 'paused' : 'ok'
  }
  const owing = current.filter((s) => dotFor(s) === 'owes')
  const firstLesson = records[0]?.date
  const enrollments = data.enrollments.filter((e) => e.groupId === group.id).sort((a, b) => (b.endedOn ?? b.startedOn).localeCompare(a.endedOn ?? a.startedOn))
  const studentName = new Map(data.students.map((s) => [s.id, s.fullName]))

  return (
    <>
      <Link to="/groups" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-brand">
        <ChevronLeft aria-hidden className="size-4" />
        {tr("All groups")}
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* ---- Left: the group card */}
        <aside aria-labelledby="group-title" className="rounded-panel border border-line bg-surface lg:sticky lg:top-20">
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div className="min-w-0">
              <h1 id="group-title" className="text-xl leading-tight font-semibold tracking-[-0.01em] text-ink">
                {group.name}
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                {course?.name ?? group.subject}
                {level ? ` → ${level.name}` : ''}
              </p>
            </div>
            <IconButton label={tr("Edit {0}", group.name)} onClick={() => setEditing(true)}>
              <Pencil />
            </IconButton>
          </div>

          <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 px-5 text-sm">
            <Row label={tr("Teacher")}>
              {teacher ? (
                <Link to={`/teachers/${teacher.id}`} className="font-medium text-brand hover:underline">
                  {teacher.fullName}
                </Link>
              ) : (
                tr("Unassigned")
              )}
            </Row>
            <Row label={tr("Price")}>
              <span className="num">{formatUZS(group.monthlyFee)}</span>
              <span className="text-ink-muted">{' '}{tr("/ month")}</span>
            </Row>
            <Row label={tr("Time")}>
              <span className="num">
                {group.startTime}–{endTime(group)}
              </span>
            </Row>
            <Row label={tr("Lesson days")}>{groupDaysLabel(group)}</Row>
            <Row label={tr("Room")}>{group.room}</Row>
            {branchName && <Row label={tr("Branch")}>{branchName}</Row>}
            <Row label={tr("First lesson")}>{firstLesson ? formatDate(firstLesson) : tr("Not started")}</Row>
            <Row label={tr("Lessons held")}>
              <span className="num">{records.length}</span>
            </Row>
            <Row label={tr("Students")}>
              <span className="num">
                {current.length} / {group.capacity}
              </span>
            </Row>
            <Row label={tr("Status")}>
              <GroupStatusBadge status={group.status} />
            </Row>
          </dl>

          <div className="mt-5 border-t border-line">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-3 text-xs text-ink-muted" aria-label={tr("Colour key")}>
              <Legend dot="owes" label={tr("Owes money")} />
              <Legend dot="ok" label={tr("Paid up")} />
              <Legend dot="paused" label={tr("Paused")} />
            </div>
            {current.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-muted">{tr("No students in this group yet.")}</p>
            ) : (
              <ol className="mt-1 pb-2">
                {current.map((s, i) => {
                  const dot = dotFor(s)
                  const owed = balances.get(s.id)?.owed ?? 0
                  return (
                    <li key={s.id}>
                      <Link
                        to={dot === 'owes' ? `/students/${s.id}?tab=payments` : `/students/${s.id}`}
                        title={dot === 'owes' ? tr("Owes {0}. Open payments", formatUZS(owed)) : tr("Open profile")}
                        className="flex items-center gap-2.5 px-5 py-1.5 text-sm hover:bg-subtle"
                      >
                        <span className="num w-5 shrink-0 text-xs text-ink-faint">{i + 1}</span>
                        <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', DOT_CLASS[dot])} />
                        <span className={cn('min-w-0 flex-1 truncate', dot === 'owes' ? 'font-medium text-danger' : 'text-ink')}>{s.fullName}</span>
                        {dot === 'owes' ? (
                          <span className="num shrink-0 text-xs font-medium text-danger">−{formatUZS(owed).replace('UZS ', '')}</span>
                        ) : (
                          <span className="num shrink-0 text-xs text-ink-muted">{s.phone || s.guardians[0]?.phone || ''}</span>
                        )}
                        <span className="sr-only">{dot === 'owes' ? tr("owes money") : dot === 'paused' ? tr("paused") : ''}</span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            )}
            {owing.length > 0 && (
              <p className="border-t border-line px-5 py-3 text-xs text-ink-muted">
                {tr("{0} of {1} owe money. Click a red name to see what they owe and take a payment.", owing.length, current.length)}
              </p>
            )}
          </div>
        </aside>

        {/* ---- Right: tabs */}
        <section className="min-w-0 rounded-panel border border-line bg-surface">
          <div role="tablist" aria-label={tr("Group sections")} className="flex gap-1 overflow-x-auto border-b border-line px-3">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => setParam('tab', t === 'attendance' ? null : t)}
                className={cn(
                  '-mb-px border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                  tab === t ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {t === 'attendance' ? tr("Attendance") : t === 'payments' ? tr("Payments") : tr("History")}
                {t === 'payments' && owing.length > 0 && <span className="num ml-1.5 rounded-full bg-danger-soft px-1.5 text-xs text-danger">{owing.length}</span>}
              </button>
            ))}
          </div>

          {tab === 'attendance' && (
            <div className="p-4 sm:p-5">
              <AttendanceJournal group={group} />
            </div>
          )}

          {tab === 'payments' &&
            (current.length === 0 ? (
              <EmptyState icon={Banknote} title={tr("No students in this group yet.")} />
            ) : (
              <TableScroll>
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-canvas">
                    <tr className="border-b border-line">
                      <th scope="col" className={th}>{tr("Student")}</th>
                      <th scope="col" className={th}>{tr("Parent phone")}</th>
                      <th scope="col" className={th}>{tr("Tuition")}</th>
                      <th scope="col" className={th}>{tr("Unpaid months")}</th>
                      <th scope="col" className={th}><span className="sr-only">{tr("Actions")}</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[...current]
                      .sort((a, b) => (balances.get(b.id)?.owed ?? 0) - (balances.get(a.id)?.owed ?? 0) || a.fullName.localeCompare(b.fullName))
                      .map((s) => {
                        const b = balances.get(s.id)
                        const phone = s.guardians[0]?.phone || s.phone
                        return (
                          <tr key={s.id}>
                            <td className={cn(td, 'whitespace-nowrap')}>
                              <Link to={`/students/${s.id}?tab=payments`} className={cn('font-medium hover:underline', dotFor(s) === 'owes' ? 'text-danger' : 'text-ink')}>
                                {s.fullName}
                              </Link>
                            </td>
                            <td className={td}>{phone ? <PhoneLine phone={phone} /> : '—'}</td>
                            <td className={td}>
                              <TuitionBadge balance={b} />
                            </td>
                            <td className={cn(td, 'whitespace-nowrap text-ink-muted')}>{b?.unpaidMonths.length ? b.unpaidMonths.map(formatMonthShort).join(', ') : '—'}</td>
                            <td className={cn(td, 'text-right whitespace-nowrap')}>
                              <IconButton label={tr("Record payment for {0}", s.fullName)} onClick={() => setPaying(s.id)}>
                                <Wallet />
                              </IconButton>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </TableScroll>
            ))}

          {tab === 'history' &&
            (enrollments.length === 0 ? (
              <EmptyState icon={History} title={tr("Nothing recorded yet")} />
            ) : (
              <ol className="divide-y divide-line">
                {enrollments.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-3 text-sm">
                    <Link to={`/students/${e.studentId}`} className="font-medium text-ink hover:text-brand hover:underline">
                      {studentName.get(e.studentId) ?? tr("Unknown student")}
                    </Link>
                    <span className="text-ink-muted">
                      {e.endedOn ? tr("{0} – {1}", formatDate(e.startedOn), formatDate(e.endedOn)) : tr("Joined {0}", formatDate(e.startedOn))}
                    </span>
                    {e.endReason && <span className="w-full text-xs text-ink-muted">{e.endReason}</span>}
                  </li>
                ))}
              </ol>
            ))}
        </section>
      </div>

      <GroupFormDialog open={editing} onClose={() => setEditing(false)} group={group} />
      <PaymentFormDialog open={paying !== null} studentId={paying ?? undefined} onClose={() => setPaying(null)} />
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </>
  )
}

function Legend({ dot, label }: { dot: Dot; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn('size-2 rounded-full', DOT_CLASS[dot])} />
      {label}
    </span>
  )
}
