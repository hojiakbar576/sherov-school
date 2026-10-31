import type { GroupStatus, PaymentStatus, StudentStatus, TeacherStatus } from '../types'
import type { SessionStatus, TuitionBalance } from '../lib/metrics'
import { formatUZSCompact, groupStatusLabel, paymentStatusLabel, studentStatusLabel, teacherStatusLabel } from '../lib/format'
import { Badge, type Tone } from './ui/Badge'

export function TuitionBadge({ balance }: { balance: TuitionBalance | undefined }) {
  if (!balance || balance.status === 'inactive') return <Badge>Not billed</Badge>
  if (balance.status === 'paid') return <Badge tone="success">Paid</Badge>
  if (balance.status === 'due') return <Badge tone="warning">Due {formatUZSCompact(balance.owed)}</Badge>
  return <Badge tone="danger">Overdue {formatUZSCompact(balance.owed)}</Badge>
}

const studentTone: Record<StudentStatus, Tone> = { active: 'success', paused: 'warning', left: 'neutral' }
export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  return <Badge tone={studentTone[status]}>{studentStatusLabel[status]}</Badge>
}

const teacherTone: Record<TeacherStatus, Tone> = { active: 'success', on_leave: 'warning' }
export function TeacherStatusBadge({ status }: { status: TeacherStatus }) {
  return <Badge tone={teacherTone[status]}>{teacherStatusLabel[status]}</Badge>
}

const groupTone: Record<GroupStatus, Tone> = { active: 'success', paused: 'warning', completed: 'neutral' }
export function GroupStatusBadge({ status }: { status: GroupStatus }) {
  return <Badge tone={groupTone[status]}>{groupStatusLabel[status]}</Badge>
}

const paymentTone: Record<PaymentStatus, Tone> = { paid: 'success', pending: 'warning', refunded: 'neutral' }
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={paymentTone[status]}>{paymentStatusLabel[status]}</Badge>
}

const sessionBadge: Record<SessionStatus, [Tone, string]> = {
  upcoming: ['neutral', 'Upcoming'],
  in_progress: ['brand', 'In progress'],
  recorded: ['success', 'Attendance taken'],
  not_recorded: ['danger', 'Attendance missing'],
}
export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const [tone, label] = sessionBadge[status]
  return <Badge tone={tone}>{label}</Badge>
}
