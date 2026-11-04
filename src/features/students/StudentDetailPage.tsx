import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
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
  paymentMethodLabel,
  tuitionAdjustmentLabel,
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
import { PaymentFormDialog } from '../payments/PaymentFormDialog'

/** One label and value on a line. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  )
}

const missing = <span className="text-ink-faint">Not added</span>

function Stat({ label, value, detail, tone }: { label: string; value: ReactNode; detail?: ReactNode; tone?: 'danger' | 'warning' }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={cn('num text-xl font-semibold', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-ink')}>{value}</p>
      {detail && <p className="text-xs text-ink-muted">{detail}</p>}
    </div>
  )
}

const markDot: Record<AttendanceMark, string> = { present: 'bg-success', late: 'bg-warning-mark', absent: 'bg-danger' }
const markText: Record<AttendanceMark, string> = { present: 'text-success', late: 'text-warning', absent: 'text-danger' }

/**
 * Everything about one student on one page, most-used first: who they are and
 * who to call, what they study, whether tuition is paid, attendance, and
 * homework progress.
 */
export function StudentDetailPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()
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
        <EmptyState icon={UserRoundX} title="Student not found" action={<ButtonLink to="/students">Back to students</ButtonLink>}>
          This student may have been deleted, or the demo data was reset.
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

  const counts = { present: 0, late: 0, absent: 0 }
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

  return (
    <>
      <Link to="/students" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        All students
      </Link>

      {/* ---- Header: who, and the two statuses that matter most */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="[&>span]:size-14 [&>span]:text-base">
            <Avatar name={student.fullName} />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.015em]">{student.fullName}</h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              {group ? `${group.name}${teacher ? ` · ${teacher.fullName}` : ''}` : 'Not in a group'}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <StudentStatusBadge status={student.status} />
              <TuitionBadge balance={balance} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setChangingStatus(true)}>
            <RefreshCcw aria-hidden />
            Change status
          </Button>
          {!archived && (
            <Button onClick={() => setTransferring(true)}>
              <ArrowRightLeft aria-hidden />
              {student.groupId ? 'Transfer' : 'Add to group'}
            </Button>
          )}
          <Button onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            Edit
          </Button>
          <Button variant="primary" onClick={() => setPaying(true)}>
            <Wallet aria-hidden />
            Record payment
          </Button>
        </div>
      </div>

      {archived && (
        <div role="note" className="mb-6 flex flex-wrap items-center gap-3 rounded-panel border border-line bg-subtle px-4 py-3 text-sm">
          <Archive aria-hidden className="size-4 text-ink-muted" />
          <p className="flex-1 text-ink">
            <span className="font-medium">In the archive.</span> {lastStatusEvent ? `${lastStatusEvent.title} on ${formatDate(lastStatusEvent.on)}${lastStatusEvent.detail ? `: ${lastStatusEvent.detail}` : ''}.` : ''} Their history is kept below.
          </p>
          <Button size="sm" onClick={() => setChangingStatus(true)}>
            Bring back
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* ---- Left: contact and study details */}
        <div className="min-w-0 space-y-6 lg:col-span-4">
          <Panel title="Parent / guardian" actions={student.guardians.length === 0 ? undefined : <span className="text-xs text-ink-muted">Main contact first</span>}>
            {student.guardians.length === 0 ? (
              <div className="text-sm">
                <p className="text-ink-muted">No parent or guardian added.</p>
                <Button size="sm" className="mt-3" onClick={() => setEditing(true)}>
                  <UserPlus aria-hidden />
                  Add parent
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
                        <span className="text-xs">Other:</span>
                        <PhoneLine phone={g.altPhone} />
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Personal details">
            <dl className="divide-y divide-line text-sm">
              <Row label="Phone">
                <PhoneLine phone={student.phone} />
              </Row>
              <Row label="Date of birth">
                {student.dateOfBirth ? (
                  <span className="num">
                    {formatDate(student.dateOfBirth)} <span className="text-ink-muted">({ageOn(student.dateOfBirth, now)} y)</span>
                  </span>
                ) : (
                  missing
                )}
              </Row>
              <Row label="Gender">{student.gender ? genderLabel[student.gender] : missing}</Row>
              <Row label="Address">{student.address ?? missing}</Row>
              <Row label="Email">
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

          <Panel title="Study">
            <dl className="divide-y divide-line text-sm">
              <Row label="Group">
                {group ? (
                  <Link to={`/groups?q=${encodeURIComponent(group.name)}`} className="hover:text-brand hover:underline">
                    {group.name}
                  </Link>
                ) : (
                  <span className="text-ink-faint">No group</span>
                )}
              </Row>
              <Row label="Course">{group?.subject ?? <span className="text-ink-faint">—</span>}</Row>
              <Row label="Teacher">{teacher?.fullName ?? <span className="text-ink-faint">None</span>}</Row>
              {group && (
                <Row label="Classes">
                  <span className="num">
                    {dayPatternLabel[group.days]}, {group.startTime}–{endTime(group)}
                    <span className="block text-xs text-ink-muted">{group.room}</span>
                  </span>
                </Row>
              )}
              <Row label="Branch">{branch?.name ?? '—'}</Row>
              <Row label="Enrolled">
                <span className="num">{formatDate(student.enrolledOn)}</span>
              </Row>
              <Row label="Status">
                <StudentStatusBadge status={student.status} />
              </Row>
            </dl>
            {groups.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-xs font-medium text-ink-muted">Group history</p>
                <ol className="space-y-2 text-sm">
                  {groups.map((e) => (
                    <li key={e.id} className="flex gap-2.5">
                      <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', e.endedOn ? 'bg-line-strong' : 'bg-brand')} />
                      <span className="min-w-0">
                        <span className="block text-ink">{groupName.get(e.groupId) ?? 'A deleted group'}</span>
                        <span className="num block text-xs text-ink-muted">
                          {formatDate(e.startedOn)} – {e.endedOn ? formatDate(e.endedOn) : 'now'}
                        </span>
                        {e.endReason && <span className="block text-xs text-ink-muted">{e.endReason}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Panel>
        </div>

        {/* ---- Right: money, attendance, progress */}
        <div className="min-w-0 space-y-6 lg:col-span-8">
          <Panel
            id="tuition"
            title="Tuition"
            actions={
              <Button size="sm" onClick={() => setPaying(true)}>
                <Wallet aria-hidden />
                Record payment
              </Button>
            }
            flush
          >
            <div className="grid grid-cols-2 gap-4 px-5 pb-4 sm:grid-cols-4">
              <Stat
                label="Monthly tuition"
                value={formatUZS(student.monthlyTuition)}
                detail={
                  student.tuitionAdjustment
                    ? `${tuitionAdjustmentLabel[student.tuitionAdjustment.kind]}: ${student.tuitionAdjustment.reason}${group ? `. Standard fee ${formatUZS(group.monthlyFee)}` : ''}`
                    : group && group.monthlyFee === student.monthlyTuition
                      ? 'The group’s standard fee'
                      : undefined
                }
              />
              <Stat
                label="Owed now"
                value={formatUZS(balance?.owed ?? 0)}
                tone={balance && balance.owed > 0 ? (balance.status === 'overdue' ? 'danger' : 'warning') : undefined}
                detail={balance?.unpaidMonths.length ? `For ${balance.unpaidMonths.map(formatMonth).join(', ')}` : balance?.status === 'inactive' ? 'Not billed while not active' : 'Nothing owed'}
              />
              <Stat label="Overdue" value={formatUZS(overdueAmount)} tone={overdueAmount > 0 ? 'danger' : undefined} detail={`Due by the ${data.settings.tuitionDueDay}th of each month`} />
              <Stat label="Paid for this month" value={formatUZS(balance?.paidThisMonth ?? 0)}  />
            </div>
            {payments.length === 0 ? (
              <EmptyState icon={Banknote} title="No payments yet" />
            ) : (
              <>
                <TableScroll>
                  <table className="w-full min-w-[520px] text-sm">
                    <caption className="sr-only">Payments, newest first</caption>
                    <thead className="border-y border-line bg-canvas">
                      <tr>
                        <th scope="col" className={th}>Paid on</th>
                        <th scope="col" className={th}>For month</th>
                        <th scope="col" className={cn(th, 'text-right')}>Amount</th>
                        <th scope="col" className={th}>Method</th>
                        <th scope="col" className={cn(th, 'hidden sm:table-cell')}>Recorded by</th>
                        <th scope="col" className={th}>Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {(allPayments ? payments : payments.slice(0, 4)).map((p) => (
                        <tr key={p.id}>
                          <td className={cn(td, 'num whitespace-nowrap')}>{formatDate(p.date)}</td>
                          <td className={cn(td, 'text-ink-muted')}>{formatMonth(p.period)}</td>
                          <td className={cn(td, 'num text-right font-medium whitespace-nowrap')}>{formatUZS(p.amount)}</td>
                          <td className={cn(td, 'text-ink-muted')}>{paymentMethodLabel[p.method]}</td>
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
                      {allPayments ? 'Show fewer' : `Show all ${payments.length} payments`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Panel>

          <Panel id="attendance" title="Attendance" flush>
            {attendance.history.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="No attendance recorded yet" />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 px-5 pb-4 sm:grid-cols-4">
                  <Stat
                    label="Attendance"
                    value={attendance.rate === null ? '—' : formatPercent(attendance.rate)}
                    tone={attendance.rate !== null && attendance.rate < 0.75 ? 'warning' : undefined}
                    detail={`${attendance.history.length} classes recorded`}
                  />
                  <Stat label="Present" value={counts.present} />
                  <Stat label="Late" value={counts.late} />
                  <Stat label="Absent" value={counts.absent} tone={counts.absent > 0 ? 'danger' : undefined} />
                </div>
                <div className="px-5 pb-4">
                  <p className="mb-2 text-xs text-ink-muted">Last {Math.min(30, attendance.history.length)} classes, oldest to newest</p>
                  <ol className="flex flex-wrap gap-1" aria-label="Recent classes">
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
                      <caption className="sr-only">Attendance history, newest first</caption>
                      <thead className="border-y border-line bg-canvas">
                        <tr>
                          <th scope="col" className={th}>Date</th>
                          <th scope="col" className={th}>Group</th>
                          <th scope="col" className={th}>Mark</th>
                          <th scope="col" className={th}>Grade</th>
                          <th scope="col" className={th}>Note</th>
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
                    {allAttendance ? 'Hide history' : 'Show full attendance history'}
                  </Button>
                </div>
              </>
            )}
          </Panel>

          <Panel
            id="progress"
            title="Homework and progress"
            description="Each number stands on its own. An overall score or ranking will come once its formula is agreed."
            flush
          >
            <div className="grid grid-cols-2 gap-4 px-5 pb-4 sm:grid-cols-3 xl:grid-cols-5">
              <Stat
                label="Homework done"
                value={performance.completionRate === null ? '—' : formatPercent(performance.completionRate)}
                tone={performance.completionRate !== null && performance.completionRate < 0.7 ? 'warning' : undefined}
                detail={performance.pastDeadline ? `${performance.pastDeadline - performance.missing} of ${performance.pastDeadline} past the deadline` : 'No deadlines yet'}
              />
              <Stat label="Homework grade" value={formatScoreAsGrade(performance.averageScore)} detail={performance.evaluated ? `Average of ${performance.evaluated}, out of 5` : 'Nothing graded yet'} />
              <Stat label="Lesson grade" value={formatAverage(avgLessonGrade)} detail={lessonGrades.length ? `Average of ${lessonGrades.length}, out of 5` : 'No lesson grades yet'} />
              <Stat label="Attendance" value={attendance.rate === null ? '—' : formatPercent(attendance.rate)} />
              <div className="min-w-0">
                <p className="text-sm text-ink-muted">Teacher assessment</p>
                <div className="mt-1.5">
                  <PerformanceBadge label={performance.label} />
                </div>
              </div>
            </div>
            {homework.length === 0 ? (
              <EmptyState icon={NotebookPen} title="No homework set yet" />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {homework.slice(0, 5).map((l) => (
                  <li key={l.homework.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{l.homework.title}</p>
                      <p className="num text-xs text-ink-muted">
                        {groupName.get(l.homework.groupId)} · due {formatDate(l.homework.dueDate)}
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

          {notes.length > 0 && (
            <Panel title="Teacher notes" description="For staff only. Parents never see these." flush>
              <ul className="divide-y divide-line border-t border-line">
                {notes.slice(0, 5).map((n) => (
                  <li key={n.id} className="px-5 py-3 text-sm">
                    <p className={cn('text-ink', n.important && 'font-medium')}>
                      {n.important && <span className="mr-1.5 rounded bg-warning-soft px-1.5 py-0.5 text-2xs font-semibold text-warning">Important</span>}
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
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <Panel id="assessments" title="Assessments" description="Tests and exams, newest first." className="lg:col-span-7" flush>
          {assessments.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="No assessment results yet" />
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
                    <span className="text-ink-faint">Absent</span>
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

        <Panel id="history" title="History" description="Enrolment, group moves, status and price changes, and payments." className="lg:col-span-5" flush>
          {timeline.length === 0 ? (
            <EmptyState icon={History} title="Nothing recorded yet" />
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
                    {allHistory ? 'Show less' : `Show all ${timeline.length} events`}
                  </Button>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>

      <div className="mt-8 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={() => setDeleting(true)} className="text-ink-muted hover:bg-danger-soft hover:text-danger">
          <Trash2 aria-hidden />
          Delete record
        </Button>
        <span className="ml-2 text-xs text-ink-muted">Only for records added by mistake. To keep the history, use Change status instead.</span>
      </div>

      <TransferDialog open={transferring} student={student} onClose={() => setTransferring(false)} />
      <StatusDialog open={changingStatus} student={student} onClose={() => setChangingStatus(false)} />
      <StudentFormDialog open={editing} student={student} onClose={() => setEditing(false)} />
      <PaymentFormDialog open={paying} studentId={student.id} onClose={() => setPaying(false)} />
      <DeleteStudentDialog student={deleting ? student : null} onClose={() => setDeleting(false)} onDeleted={() => navigate('/students')} />
    </>
  )
}
