import { useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Archive, ArrowLeft, ArrowRightLeft, Banknote, ClipboardCheck, History, NotebookPen, Pencil, RefreshCcw, Trash2, UserPlus, UserRoundX, Wallet } from 'lucide-react'
import type { AttendanceMark } from '../../types'
import { useSchool } from '../../data/school-context'
import { Panel } from '../../components/ui/Panel'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Avatar, EmptyState, TableScroll, td, th } from '../../components/ui/misc'
import { PhoneLine } from '../../components/ui/CopyButton'
import { PaymentStatusBadge, StudentStatusBadge, TuitionBadge } from '../../components/StatusBadges'
import { monthKey } from '../../lib/dates'
import {
  ageOn,
  attendanceMarkLabel,
  dayPatternLabel,
  formatDate,
  formatMonth,
  formatPercent,
  formatUZS,
  genderLabel,
  guardianRelationshipLabel,
  methodName,   tuitionAdjustmentLabel,
} from '../../lib/format'
import { groupHistory, isArchived, studentTimeline } from '../../lib/student-lifecycle'
import { studentAssessments } from '../../lib/assessments'
import { studentAttendance } from '../../lib/metrics'
import { studentHomework, studentPerformance } from '../../lib/performance'
import { endTime } from '../../lib/schedule'
import { cn } from '../../lib/cn'
import { PerformanceBadge, ResultStatusBadge } from '../teacher/LearningBadges'
import { GradeChip } from '../teacher/group/GradeChip'
import { formatAverage, formatScoreAsGrade, scoreToGrade } from '../teacher/group/grade-style'
import { StudentFormDialog } from './StudentFormDialog'
import { DeleteStudentDialog } from './DeleteStudentDialog'
import { StatusDialog, TransferDialog } from './StudentLifecycleDialogs'
import { TagChips } from './StudentTags'
import { ExtraLessonsPanel } from './ExtraLessonsPanel'
import { ContactLogPanel } from '../contacts/ContactLogPanel'
import { PaymentFormDialog } from '../payments/PaymentFormDialog'
import { tr } from '../../i18n'

/** One label and value on a line. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  )
}

const missing = <span className="text-ink-faint">{tr("Not added")}</span>

function Stat({ label, value, detail, tone }: { label: string; value: ReactNode; detail?: ReactNode; tone?: 'danger' | 'warning' }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={cn('num text-xl font-semibold', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-ink')}>{value}</p>
      {detail && <p className="text-xs text-ink-muted">{detail}</p>}
    </div>
  )
}

const markDot: Record<AttendanceMark, string> = { present: 'bg-success', late: 'bg-warning-mark', absent: 'bg-danger', excused: 'bg-info' }
const markText: Record<AttendanceMark, string> = { present: 'text-success', late: 'text-warning', absent: 'text-danger', excused: 'text-info' }

/**
 * Everything about one student on one page, most-used first: who they are and
 * who to call, what they study, whether tuition is paid, attendance, and
 * homework progress.
 */
const TABS = ['groups', 'payments', 'attendance', 'progress', 'contact', 'notes', 'history'] as const
type Tab = (typeof TABS)[number]
/** Old links pointed at a section with #name; they open the matching tab. */
const HASH_TAB: Record<string, Tab> = { '#tuition': 'payments', '#attendance': 'attendance', '#assessments': 'progress', '#progress': 'progress', '#history': 'history' }

/** One fact in the summary card. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-ink">{children}</dd>
    </div>
  )
}

/**
 * One student: a summary card with what staff need at a glance, then the rest
 * in tabs (?tab=payments opens the money side straight away).
 */
export function StudentDetailPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab') as Tab | null
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : (HASH_TAB[location.hash] ?? 'groups')
  const setTab = (t: Tab) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (t === 'groups') next.delete('tab')
        else next.set('tab', t)
        return next
      },
      { replace: true },
    )
  const { data, now, balances } = useSchool()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [paying, setPaying] = useState(false)
  const [allPayments, setAllPayments] = useState(false)
  const [allAttendance, setAllAttendance] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [allHistory, setAllHistory] = useState(false)

  const student = data.students.find((s) => s.id === studentId)
  const attendance = useMemo(() => (student ? studentAttendance(data, student.id) : null), [data, student])
  const performance = useMemo(() => (student ? studentPerformance(data, student.id, now) : null), [data, student, now])
  const homework = useMemo(() => (student ? studentHomework(data, student.id, now) : []), [data, student, now])
  const payments = useMemo(
    () => data.payments.filter((p) => p.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date)),
    [data.payments, studentId],
  )

  if (!student || !attendance || !performance) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        <EmptyState icon={UserRoundX} title={tr("Student not found")} action={<ButtonLink to="/students">{tr("Back to students")}</ButtonLink>}>
          {tr("This student may have been deleted, or the demo data was reset.")}
        </EmptyState>
      </div>
    )
  }

  const group = data.groups.find((g) => g.id === student.groupId)
  const teacher = data.teachers.find((t) => t.id === group?.teacherId)
  const branch = data.branches.find((b) => b.id === student.branchId)
  const balance = balances.get(student.id)
  const groupName = new Map(data.groups.map((g) => [g.id, g.name]))
  const recordFor = (groupId: string, date: string) => data.attendance.find((r) => r.groupId === groupId && r.date === date)

  // Overdue part of what's owed: earlier months always, this month after the due day.
  const currentMonth = monthKey(now)
  const paidFor = (period: string) => payments.filter((p) => p.status === 'paid' && p.period === period).reduce((sum, p) => sum + p.amount, 0)
  const overdueAmount =
    balance?.status === 'overdue'
      ? balance.unpaidMonths
          .filter((m) => m < currentMonth || now.getDate() > data.settings.tuitionDueDay)
          .reduce((sum, m) => sum + Math.max(0, student.monthlyTuition - paidFor(m)), 0)
      : 0

  const counts = { present: 0, late: 0, absent: 0, excused: 0 }
  for (const h of attendance.history) counts[h.mark] += 1
  const lessonGrades = attendance.history.map((h) => recordFor(h.groupId, h.date)?.grades?.[student.id]).filter((g): g is NonNullable<typeof g> => g !== undefined)
  const avgLessonGrade = lessonGrades.length ? lessonGrades.reduce((a, b) => a + b, 0) / lessonGrades.length : null
  const notes = data.studentNotes.filter((n) => n.studentId === student.id)
  const groups = groupHistory(data, student.id)
  const timeline = studentTimeline(data, student.id)
  const assessments = studentAssessments(data, student.id)
  const archived = isArchived(student.status)
  const lastStatusEvent = [...data.studentEvents].reverse().find((e) => e.studentId === student.id && e.type === 'status_changed')
  const userName = new Map(data.users.map((u) => [u.id, u.fullName]))
  const mainGuardian = student.guardians[0]
  const owes = Boolean(balance && balance.owed > 0 && (balance.status === 'due' || balance.status === 'overdue'))
  const tabLabel: Record<Tab, string> = {
    groups: tr("Groups"),
    payments: tr("Payments"),
    attendance: tr("Attendance"),
    progress: tr("Assessments"),
    contact: tr("Parents and calls"),
    notes: tr("Notes"),
    history: tr("History"),
  }

  return (
    <>
      <Link to="/students" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        {tr("All students")}
      </Link>

      {/* ---- Summary card: the details staff need at a glance */}
      <section aria-labelledby="student-name" className="mb-6 rounded-panel border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="[&>span]:size-14 [&>span]:text-base">
              <Avatar name={student.fullName} />
            </span>
            <div className="min-w-0">
              <h1 id="student-name" className="text-2xl font-semibold tracking-[-0.015em]">
                {student.fullName}
              </h1>
              <p className="num mt-0.5 text-xs text-ink-muted">ID: {student.id.replace(/^stu_/, '').toUpperCase()}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <StudentStatusBadge status={student.status} />
                <TuitionBadge balance={balance} />
                <TagChips tags={student.tags} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setChangingStatus(true)}>
              <RefreshCcw aria-hidden />
              {tr("Change status")}
            </Button>
            {!archived && (
              <Button onClick={() => setTransferring(true)}>
                <ArrowRightLeft aria-hidden />
                {student.groupId ? tr("Transfer") : tr("Add to group")}
              </Button>
            )}
            <Button onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              {tr("Edit")}
            </Button>
            <Button variant="primary" onClick={() => setPaying(true)}>
              <Wallet aria-hidden />
              {tr("Record payment")}
            </Button>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-sm xl:grid-cols-4">
          <Fact label={tr("Balance")}>
            {owes ? (
              <button type="button" onClick={() => setTab('payments')} className="num font-semibold text-danger hover:underline">
                {tr("Owes {0}", formatUZS(balance!.owed))}
              </button>
            ) : (
              <span className="text-ink">{tr("Nothing owed")}</span>
            )}
          </Fact>
          <Fact label={tr("Phone")}>{student.phone ? <PhoneLine phone={student.phone} /> : missing}</Fact>
          <Fact label={mainGuardian ? guardianRelationshipLabel[mainGuardian.relationship] : tr("Parent / guardian")}>
            {mainGuardian ? (
              <span>
                {mainGuardian.fullName} <PhoneLine phone={mainGuardian.phone} className="text-ink-muted" />
              </span>
            ) : (
              missing
            )}
          </Fact>
          <Fact label={tr("Enrolled")}>
            <span className="num">{formatDate(student.enrolledOn)}</span>
            {branch && <span className="text-ink-muted"> · {branch.name}</span>}
          </Fact>
          <Fact label={tr("Group")}>
            {group ? (
              <Link to={`/groups/${group.id}`} className="font-medium text-brand hover:underline">
                {group.name}
              </Link>
            ) : (
              <span className="text-ink-faint">{tr("Not in a group")}</span>
            )}
          </Fact>
          <Fact label={tr("Course and level")}>{group ? `${group.subject}${group.level ? ` → ${group.level}` : ''}` : missing}</Fact>
          <Fact label={tr("Teacher")}>
            {teacher ? (
              <Link to={`/teachers/${teacher.id}`} className="hover:text-brand hover:underline">
                {teacher.fullName}
              </Link>
            ) : (
              missing
            )}
          </Fact>
          <Fact label={tr("Classes")}>
            {group ? (
              <span className="num">
                {dayPatternLabel[group.days]}, {group.startTime}–{endTime(group)}
              </span>
            ) : (
              missing
            )}
          </Fact>
        </dl>
      </section>

      {archived && (
        <div role="note" className="mb-6 flex flex-wrap items-center gap-3 rounded-panel border border-line bg-subtle px-4 py-3 text-sm">
          <Archive aria-hidden className="size-4 text-ink-muted" />
          <p className="flex-1 text-ink">
            <span className="font-medium">{tr("In the archive.")}</span> {lastStatusEvent ? tr("{0} on {1}{2}.", lastStatusEvent.title, formatDate(lastStatusEvent.on), lastStatusEvent.detail ? `: ${lastStatusEvent.detail}` : '') : ''}{' '}{tr("Their history is kept in the tabs below.")}
          </p>
          <Button size="sm" onClick={() => setChangingStatus(true)}>
            {tr("Bring back")}
          </Button>
        </div>
      )}

      {/* ---- Everything else, one tab at a time */}
      <div role="tablist" aria-label={tr("Student sections")} className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            id={`tab-${t}`}
            role="tab"
            type="button"
            aria-selected={tab === t}
            aria-controls="student-tabpanel"
            onClick={() => setTab(t)}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              tab === t ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {tabLabel[t]}
            {t === 'payments' && owes && <span aria-label={tr("owes money")} className="ml-1.5 inline-block size-2 rounded-full bg-danger-mark align-middle" />}
            {t === 'notes' && notes.length > 0 && <span className="num ml-1.5 text-xs text-ink-faint">{notes.length}</span>}
          </button>
        ))}
      </div>

      <div id="student-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-w-0">
        {tab === 'groups' && (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <Panel title={tr("Study")}>
              <dl className="divide-y divide-line text-sm">
                <Row label={tr("Group")}>
                  {group ? (
                    <Link to={`/groups/${group.id}`} className="hover:text-brand hover:underline">
                      {group.name}
                    </Link>
                  ) : (
                    <span className="text-ink-faint">{tr("No group")}</span>
                  )}
                </Row>
                <Row label={tr("Course")}>{group?.subject ?? <span className="text-ink-faint">—</span>}</Row>
                <Row label={tr("Teacher")}>{teacher?.fullName ?? <span className="text-ink-faint">{tr("None")}</span>}</Row>
                {group && (
                  <Row label={tr("Classes")}>
                    <span className="num">
                      {dayPatternLabel[group.days]}, {group.startTime}–{endTime(group)}
                      <span className="block text-xs text-ink-muted">{group.room}</span>
                    </span>
                  </Row>
                )}
                <Row label={tr("Branch")}>{branch?.name ?? '—'}</Row>
                <Row label={tr("Enrolled")}>
                  <span className="num">{formatDate(student.enrolledOn)}</span>
                </Row>
                <Row label={tr("Status")}>
                  <StudentStatusBadge status={student.status} />
                </Row>
              </dl>
              {groups.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="mb-2 text-xs font-medium text-ink-muted">{tr("Group history")}</p>
                  <ol className="space-y-2 text-sm">
                    {groups.map((e) => (
                      <li key={e.id} className="flex gap-2.5">
                        <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', e.endedOn ? 'bg-line-strong' : 'bg-brand')} />
                        <span className="min-w-0">
                          <span className="block text-ink">{groupName.get(e.groupId) ?? tr("A deleted group")}</span>
                          <span className="num block text-xs text-ink-muted">
                            {formatDate(e.startedOn)} – {e.endedOn ? formatDate(e.endedOn) : tr("now")}
                          </span>
                          {e.endReason && <span className="block text-xs text-ink-muted">{e.endReason}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </Panel>
            <ExtraLessonsPanel student={student} />
          </div>
        )}

        {tab === 'payments' && (
          <Panel
            title={tr("Tuition")}
            actions={
              <Button size="sm" onClick={() => setPaying(true)}>
                <Wallet aria-hidden />
                {tr("Record payment")}
              </Button>
            }
            flush
          >
            <div className="grid grid-cols-2 gap-4 px-5 pb-4 sm:grid-cols-4">
              <Stat
                label={tr("Monthly tuition")}
                value={formatUZS(student.monthlyTuition)}
                detail={
                  student.tuitionAdjustment ? `${tuitionAdjustmentLabel[student.tuitionAdjustment.kind]}: ${student.tuitionAdjustment.reason}${group ? `. Standard fee ${formatUZS(group.monthlyFee)}` : ''}` : group && group.monthlyFee === student.monthlyTuition ? tr("The group’s standard fee") : undefined
                }
              />
              <Stat
                label={tr("Owed now")}
                value={formatUZS(balance?.owed ?? 0)}
                tone={balance && balance.owed > 0 ? (balance.status === 'overdue' ? 'danger' : 'warning') : undefined}
                detail={balance?.unpaidMonths.length ? tr("For {0}", balance.unpaidMonths.map(formatMonth).join(', ')) : balance?.status === 'inactive' ? tr("Not billed while not active") : tr("Nothing owed")}
              />
              <Stat label={tr("Overdue")} value={formatUZS(overdueAmount)} tone={overdueAmount > 0 ? 'danger' : undefined} detail={tr("Due by the {0}th of each month", data.settings.tuitionDueDay)} />
              <Stat label={tr("Paid for this month")} value={formatUZS(balance?.paidThisMonth ?? 0)}  />
            </div>
            {payments.length === 0 ? (
              <EmptyState icon={Banknote} title={tr("No payments yet")} />
            ) : (
              <>
                <TableScroll>
                  <table className="w-full min-w-[520px] text-sm">
                    <caption className="sr-only">{tr("Payments, newest first")}</caption>
                    <thead className="border-y border-line bg-canvas">
                      <tr>
                        <th scope="col" className={th}>{tr("Paid on")}</th>
                        <th scope="col" className={th}>{tr("For month")}</th>
                        <th scope="col" className={cn(th, 'text-right')}>{tr("Amount")}</th>
                        <th scope="col" className={th}>{tr("Method")}</th>
                        <th scope="col" className={cn(th, 'hidden sm:table-cell')}>{tr("Recorded by")}</th>
                        <th scope="col" className={th}>{tr("Status")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {(allPayments ? payments : payments.slice(0, 4)).map((p) => (
                        <tr key={p.id}>
                          <td className={cn(td, 'num whitespace-nowrap')}>{formatDate(p.date)}</td>
                          <td className={cn(td, 'text-ink-muted')}>{formatMonth(p.period)}</td>
                          <td className={cn(td, 'num text-right font-medium whitespace-nowrap')}>{formatUZS(p.amount)}</td>
                          <td className={cn(td, 'text-ink-muted')}>{methodName(data.catalogs, p.method)}</td>
                          <td className={cn(td, 'hidden text-ink-muted sm:table-cell')}>{(p.recordedBy && userName.get(p.recordedBy)) ?? '—'}</td>
                          <td className={td}>
                            <PaymentStatusBadge status={p.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
                {payments.length > 4 && (
                  <div className="border-t border-line px-5 py-2.5">
                    <Button size="sm" variant="ghost" onClick={() => setAllPayments((v) => !v)}>
                      {allPayments ? tr("Show fewer") : tr("Show all {0} payments", payments.length)}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Panel>
        )}

        {tab === 'attendance' && (
          <Panel title={tr("Attendance")} flush>
            {attendance.history.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title={tr("No attendance recorded yet")} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 px-5 pb-4 sm:grid-cols-4">
                  <Stat
                    label={tr("Attendance")}
                    value={attendance.rate === null ? '—' : formatPercent(attendance.rate)}
                    tone={attendance.rate !== null && attendance.rate < 0.75 ? 'warning' : undefined}
                    detail={tr("{0} classes recorded", attendance.history.length)}
                  />
                  <Stat label={tr("Present")} value={counts.present} />
                  <Stat label={tr("Late")} value={counts.late} />
                  <Stat label={tr("Absent")} value={counts.absent} tone={counts.absent > 0 ? 'danger' : undefined} />
                </div>
                <div className="px-5 pb-4">
                  <p className="mb-2 text-xs text-ink-muted">{tr("Last")}{' '}{Math.min(30, attendance.history.length)}{' '}{tr("classes, oldest to newest")}</p>
                  <ol className="flex flex-wrap gap-1" aria-label={tr("Recent classes")}>
                    {attendance.history
                      .slice(0, 30)
                      .reverse()
                      .map((h) => (
                        <li
                          key={`${h.groupId}-${h.date}`}
                          title={`${formatDate(h.date)}: ${attendanceMarkLabel[h.mark]}`}
                          className={cn('h-6 w-3 rounded-sm', markDot[h.mark])}
                        >
                          <span className="sr-only">
                            {formatDate(h.date)}: {attendanceMarkLabel[h.mark]}
                          </span>
                        </li>
                      ))}
                  </ol>
                </div>
                {allAttendance && (
                  <TableScroll>
                    <table className="w-full min-w-[520px] text-sm">
                      <caption className="sr-only">{tr("Attendance history, newest first")}</caption>
                      <thead className="border-y border-line bg-canvas">
                        <tr>
                          <th scope="col" className={th}>{tr("Date")}</th>
                          <th scope="col" className={th}>{tr("Group")}</th>
                          <th scope="col" className={th}>{tr("Mark")}</th>
                          <th scope="col" className={th}>{tr("Grade")}</th>
                          <th scope="col" className={th}>{tr("Note")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {attendance.history.map((h) => {
                          const r = recordFor(h.groupId, h.date)
                          const grade = r?.grades?.[student.id]
                          return (
                            <tr key={`${h.groupId}-${h.date}`}>
                              <td className={cn(td, 'num whitespace-nowrap')}>{formatDate(h.date)}</td>
                              <td className={cn(td, 'text-ink-muted')}>{groupName.get(h.groupId) ?? '—'}</td>
                              <td className={cn(td, 'font-medium', markText[h.mark])}>{attendanceMarkLabel[h.mark]}</td>
                              <td className={cn(td, 'py-2')}>{grade ? <GradeChip grade={grade} size="sm" /> : <span className="text-ink-faint">—</span>}</td>
                              <td className={cn(td, 'text-ink-muted')}>{r?.comments?.[student.id] ?? ''}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </TableScroll>
                )}
                <div className="border-t border-line px-5 py-2.5">
                  <Button size="sm" variant="ghost" onClick={() => setAllAttendance((v) => !v)}>
                    {allAttendance ? tr("Hide history") : tr("Show full attendance history")}
                  </Button>
                </div>
              </>
            )}
          </Panel>
        )}

        {tab === 'progress' && (
          <div className="space-y-6">
            <Panel
              title={tr("Homework and progress")}
              description={tr("Each number stands on its own. An overall score or ranking will come once its formula is agreed.")}
              flush
            >
              <div className="grid grid-cols-2 gap-4 px-5 pb-4 sm:grid-cols-3 xl:grid-cols-5">
                <Stat
                  label={tr("Homework done")}
                  value={performance.completionRate === null ? '—' : formatPercent(performance.completionRate)}
                  tone={performance.completionRate !== null && performance.completionRate < 0.7 ? 'warning' : undefined}
                  detail={performance.pastDeadline ? tr("{0} of {1} past the deadline", performance.pastDeadline - performance.missing, performance.pastDeadline) : tr("No deadlines yet")}
                />
                <Stat label={tr("Homework grade")} value={formatScoreAsGrade(performance.averageScore)} detail={performance.evaluated ? tr("Average of {0}, out of 5", performance.evaluated) : tr("Nothing graded yet")} />
                <Stat label={tr("Lesson grade")} value={formatAverage(avgLessonGrade)} detail={lessonGrades.length ? tr("Average of {0}, out of 5", lessonGrades.length) : tr("No lesson grades yet")} />
                <Stat label={tr("Attendance")} value={attendance.rate === null ? '—' : formatPercent(attendance.rate)} />
                <div className="min-w-0">
                  <p className="text-sm text-ink-muted">{tr("Teacher assessment")}</p>
                  <div className="mt-1.5">
                    <PerformanceBadge label={performance.label} />
                  </div>
                </div>
              </div>
              {homework.length === 0 ? (
                <EmptyState icon={NotebookPen} title={tr("No homework set yet")} />
              ) : (
                <ul className="divide-y divide-line border-t border-line">
                  {homework.slice(0, 5).map((l) => (
                    <li key={l.homework.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{l.homework.title}</p>
                        <p className="num text-xs text-ink-muted">
                          {groupName.get(l.homework.groupId)}{' '}{tr("· due")}{' '}{formatDate(l.homework.dueDate)}
                        </p>
                        {l.result?.evaluation?.feedback && <p className="mt-0.5 text-xs text-ink">“{l.result.evaluation.feedback}”</p>}
                      </div>
                      <ResultStatusBadge status={l.status} overdue={l.due} />
                      {l.result?.evaluation ? <GradeChip grade={scoreToGrade(l.result.evaluation.score)} size="sm" /> : <span className="w-6" />}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title={tr("Assessments")} description={tr("Tests and exams, newest first.")} flush>
              {assessments.length === 0 ? (
                <EmptyState icon={ClipboardCheck} title={tr("No assessment results yet")} />
              ) : (
                <ul className="divide-y divide-line border-t border-line">
                  {assessments.map(({ assessment, result, percent }) => (
                    <li key={assessment.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">{assessment.title}</p>
                        <p className="num text-xs text-ink-muted">
                          {groupName.get(assessment.groupId)} · {formatDate(assessment.date)}
                        </p>
                        {result.comment && <p className="mt-0.5 text-xs text-ink">“{result.comment}”</p>}
                      </div>
                      {result.score === null ? (
                        <span className="text-ink-faint">{tr("Absent")}</span>
                      ) : (
                        <span className="num text-right">
                          <span className="font-semibold text-ink">
                            {result.score}/{assessment.maxScore}
                          </span>
                          <span className={cn('block text-xs', percent !== null && percent < 0.6 ? 'text-danger' : 'text-ink-muted')}>{percent === null ? '' : formatPercent(percent)}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        )}

        {tab === 'contact' && (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <Panel title={tr("Parent / guardian")} actions={student.guardians.length === 0 ? undefined : <span className="text-xs text-ink-muted">{tr("Main contact first")}</span>}>
                {student.guardians.length === 0 ? (
                  <div className="text-sm">
                    <p className="text-ink-muted">{tr("No parent or guardian added.")}</p>
                    <Button size="sm" className="mt-3" onClick={() => setEditing(true)}>
                      <UserPlus aria-hidden />
                      {tr("Add parent")}
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {student.guardians.map((g) => (
                      <li key={g.id} className="text-sm">
                        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">{guardianRelationshipLabel[g.relationship]}</p>
                        <p className="font-medium text-ink">{g.fullName}</p>
                        <PhoneLine phone={g.phone} className="text-ink" />
                        {g.altPhone && (
                          <p className="flex items-center gap-1 text-ink-muted">
                            <span className="text-xs">{tr("Other:")}</span>
                            <PhoneLine phone={g.altPhone} />
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title={tr("Personal details")}>
                <dl className="divide-y divide-line text-sm">
                  <Row label={tr("Phone")}>
                    <PhoneLine phone={student.phone} />
                  </Row>
                  <Row label={tr("Date of birth")}>
                    {student.dateOfBirth ? (
                      <span className="num">
                        {formatDate(student.dateOfBirth)} <span className="text-ink-muted">({ageOn(student.dateOfBirth, now)}{' '}{tr("y)")}</span>
                      </span>
                    ) : (
                      missing
                    )}
                  </Row>
                  <Row label={tr("Gender")}>{student.gender ? genderLabel[student.gender] : missing}</Row>
                  <Row label={tr("Address")}>{student.address ?? missing}</Row>
                  <Row label={tr("Email")}>
                    {student.email ? (
                      <a href={`mailto:${student.email}`} className="break-all hover:text-brand hover:underline">
                        {student.email}
                      </a>
                    ) : (
                      missing
                    )}
                  </Row>
                </dl>
              </Panel>
            </div>
            <ContactLogPanel
              subject={{ type: 'student', id: student.id }}
              contacts={[...student.guardians.map((g) => `${g.fullName} (${guardianRelationshipLabel[g.relationship].toLowerCase()})`), student.fullName]}
            />
          </div>
        )}

        {tab === 'notes' && (
          <>
                      {notes.length === 0 ? (
              <div className="rounded-panel border border-line bg-surface">
                <EmptyState icon={NotebookPen} title={tr("No teacher notes yet")}>{tr("Teachers add notes from their portal. Parents never see them.")}</EmptyState>
              </div>
            ) : (
                        <Panel title={tr("Teacher notes")} description={tr("For staff only. Parents never see these.")} flush>
                          <ul className="divide-y divide-line border-t border-line">
                            {notes.map((n) => (
                              <li key={n.id} className="px-5 py-3 text-sm">
                                <p className={cn('text-ink', n.important && 'font-medium')}>
                                  {n.important && <span className="mr-1.5 rounded bg-warning-soft px-1.5 py-0.5 text-2xs font-semibold text-warning">{tr("Important")}</span>}
                                  {n.text}
                                </p>
                                <p className="num mt-0.5 text-xs text-ink-muted">
                                  {n.authorName} · {formatDate(n.createdAt.slice(0, 10))}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </Panel>
                      )}
          </>
        )}

        {tab === 'history' && (
          <>
            <Panel title={tr("History")} description={tr("Enrolment, group moves, status and price changes, and payments.")} flush>
              {timeline.length === 0 ? (
                <EmptyState icon={History} title={tr("Nothing recorded yet")} />
              ) : (
                <>
                  <ol className="space-y-3 border-t border-line px-5 py-4">
                    {(allHistory ? timeline : timeline.slice(0, 8)).map((item) => (
                      <li key={item.id} className="flex gap-3 text-sm">
                        <span className="num w-20 shrink-0 text-xs text-ink-muted">{formatDate(item.on)}</span>
                        <span className="min-w-0">
                          <span className={cn('block', item.kind === 'payment' ? 'text-ink-muted' : 'font-medium text-ink')}>{item.title}</span>
                          {item.detail && <span className="block text-xs text-ink-muted">{item.detail}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {timeline.length > 8 && (
                    <div className="border-t border-line px-5 py-2.5">
                      <Button size="sm" variant="ghost" onClick={() => setAllHistory((v) => !v)}>
                        {allHistory ? tr("Show less") : tr("Show all {0} events", timeline.length)}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Panel>
            <div className="mt-6 border-t border-line pt-4">
              <Button variant="ghost" size="sm" onClick={() => setDeleting(true)} className="text-ink-muted hover:bg-danger-soft hover:text-danger">
                <Trash2 aria-hidden />
                {tr("Delete record")}
              </Button>
              <span className="ml-2 text-xs text-ink-muted">{tr("Only for records added by mistake. To keep the history, use Change status instead.")}</span>
            </div>
          </>
        )}
      </div>

      <TransferDialog open={transferring} student={student} onClose={() => setTransferring(false)} />
      <StatusDialog open={changingStatus} student={student} onClose={() => setChangingStatus(false)} />
      <StudentFormDialog open={editing} student={student} onClose={() => setEditing(false)} />
      <PaymentFormDialog open={paying} studentId={student.id} onClose={() => setPaying(false)} />
      <DeleteStudentDialog student={deleting ? student : null} onClose={() => setDeleting(false)} onDeleted={() => navigate('/students')} />
    </>
  )
}
