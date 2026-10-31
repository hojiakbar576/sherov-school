import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Banknote, ClipboardCheck, Pencil, Trash2, UserRoundX, Wallet } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { Panel } from '../../components/ui/Panel'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Avatar, EmptyState, TableScroll, td, th } from '../../components/ui/misc'
import { PaymentStatusBadge, StudentStatusBadge, TuitionBadge } from '../../components/StatusBadges'
import { attendanceMarkLabel, formatDate, formatMonth, formatPercent, formatUZS, paymentMethodLabel } from '../../lib/format'
import { studentAttendance } from '../../lib/metrics'
import { cn } from '../../lib/cn'
import type { AttendanceMark } from '../../types'
import { StudentFormDialog } from './StudentFormDialog'
import { DeleteStudentDialog } from './DeleteStudentDialog'
import { PaymentFormDialog } from '../payments/PaymentFormDialog'

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 first:pt-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-ink">{children}</dd>
    </div>
  )
}

const markTone = { present: 'success', late: 'warning', absent: 'danger' } as const satisfies Record<AttendanceMark, string>

export function StudentDetailPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const { data, balances } = useSchool()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [paying, setPaying] = useState(false)

  const student = data.students.find((s) => s.id === studentId)
  const attendance = useMemo(() => (student ? studentAttendance(data, student.id) : null), [data, student])
  const payments = useMemo(
    () => data.payments.filter((p) => p.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date)),
    [data.payments, studentId],
  )

  if (!student || !attendance) {
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
  const balance = balances.get(student.id)
  const groupName = new Map(data.groups.map((g) => [g.id, g.name]))

  return (
    <>
      <Link to="/students" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        All students
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={student.fullName} />
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.015em]">{student.fullName}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <StudentStatusBadge status={student.status} />
              <TuitionBadge balance={balance} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setDeleting(true)} className="hover:bg-danger-soft hover:text-danger">
            <Trash2 aria-hidden />
            Delete
          </Button>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Details" className="lg:col-span-1">
          <dl className="divide-y divide-line text-sm">
            <Detail label="Phone">
              <a href={`tel:${student.phone.replace(/s/g, '')}`} className="num hover:text-brand hover:underline">{student.phone}</a>
            </Detail>
            <Detail label="Email">
              {student.email ? <a href={`mailto:${student.email}`} className="hover:text-brand hover:underline">{student.email}</a> : <span className="text-ink-faint">Not provided</span>}
            </Detail>
            <Detail label="Group">
              {group ? <Link to={`/groups?q=${encodeURIComponent(group.name)}`} className="hover:text-brand hover:underline">{group.name}</Link> : <span className="text-ink-faint">No group</span>}
            </Detail>
            <Detail label="Teacher">{teacher?.fullName ?? <span className="text-ink-faint">None</span>}</Detail>
            <Detail label="Enrolled">{formatDate(student.enrolledOn)}</Detail>
            <Detail label="Monthly tuition">
              <span className="num">{formatUZS(student.monthlyTuition)}</span>
            </Detail>
          </dl>
        </Panel>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel title="Tuition" description="Billed monthly from enrolment. Earlier months in the demo are treated as settled.">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-ink-muted">Owed now</p>
                <p className={cn('num text-xl font-semibold', balance && balance.owed > 0 ? 'text-danger' : 'text-ink')}>{formatUZS(balance?.owed ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-ink-muted">Paid for this month</p>
                <p className="num text-xl font-semibold">{formatUZS(balance?.paidThisMonth ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-ink-muted">Unpaid months</p>
                <p className="text-sm font-medium text-ink">{balance?.unpaidMonths.length ? balance.unpaidMonths.map(formatMonth).join(', ') : 'None'}</p>
              </div>
            </div>
          </Panel>

          <Panel title="Payment history" description={`${payments.length} ${payments.length === 1 ? 'payment' : 'payments'}`} flush>
            {payments.length === 0 ? (
              <EmptyState icon={Banknote} title="No payments yet" action={<Button onClick={() => setPaying(true)}>Record payment</Button>} />
            ) : (
              <TableScroll>
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-y border-line bg-canvas">
                    <tr>
                      <th scope="col" className={th}>Date</th>
                      <th scope="col" className={th}>For month</th>
                      <th scope="col" className={cn(th, 'text-right')}>Amount</th>
                      <th scope="col" className={th}>Method</th>
                      <th scope="col" className={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {payments.slice(0, 12).map((p) => (
                      <tr key={p.id}>
                        <td className={cn(td, 'num whitespace-nowrap')}>{formatDate(p.date)}</td>
                        <td className={cn(td, 'text-ink-muted')}>{formatMonth(p.period)}</td>
                        <td className={cn(td, 'num text-right font-medium whitespace-nowrap')}>{formatUZS(p.amount)}</td>
                        <td className={cn(td, 'text-ink-muted')}>{paymentMethodLabel[p.method]}</td>
                        <td className={td}>
                          <PaymentStatusBadge status={p.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Panel>

          <Panel
            title="Attendance"
            description={attendance.rate === null ? 'No classes recorded yet' : `${formatPercent(attendance.rate)} attended over ${attendance.history.length} recorded classes`}
          >
            {attendance.history.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="No attendance recorded" />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {attendance.history.slice(0, 24).map((h) => (
                  <li key={`${h.groupId}-${h.date}`}>
                    <Badge tone={markTone[h.mark]}>
                      <span className="num">{formatDate(h.date).slice(0, -5)}</span>
                      <span className="sr-only">
                        {' '}
                        {attendanceMarkLabel[h.mark]}, {groupName.get(h.groupId)}
                      </span>
                      <span aria-hidden className="text-[0.6875rem] opacity-80">
                        {attendanceMarkLabel[h.mark]}
                      </span>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <StudentFormDialog open={editing} student={student} onClose={() => setEditing(false)} />
      <PaymentFormDialog open={paying} studentId={student.id} onClose={() => setPaying(false)} />
      <DeleteStudentDialog student={deleting ? student : null} onClose={() => setDeleting(false)} onDeleted={() => navigate('/students')} />
    </>
  )
}
