import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ClipboardCheck, Plus, Wallet } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { useAttention } from '../../hooks/useAttention'
import { Button, ButtonLink } from '../../components/ui/Button'
import { monthKey, toISODate } from '../../lib/dates'
import { formatLongDate, greeting } from '../../lib/format'
import { outstandingTotal, recordsOn, revenueInMonth, sessionsOn, summarizeMarks } from '../../lib/metrics'
import { StudentFormDialog } from '../students/StudentFormDialog'
import { PaymentFormDialog } from '../payments/PaymentFormDialog'
import { KpiStrip } from './KpiStrip'
import { TodayClasses } from './TodayClasses'
import { TodayTasks } from './TodayTasks'
import { RecentActivity } from './RecentActivity'

/**
 * Answers one question: what does the administrator need to know or do today?
 * Numbers first, then tasks with actions, then today's classes. Trends and
 * charts live on the Reports page.
 */
export function DashboardPage() {
  const { data, now, balances, user, branch } = useSchool()
  const attention = useAttention()
  const [addingStudent, setAddingStudent] = useState(false)
  // undefined = closed, '' = open without a student, id = open for that student
  const [paymentFor, setPaymentFor] = useState<string | undefined>(undefined)

  const today = toISODate(now)
  const sessions = useMemo(() => sessionsOn(data, today, now), [data, today, now])
  const todayMarks = useMemo(() => summarizeMarks(recordsOn(data, today)), [data, today])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink">
            {greeting(now)}, {user?.fullName.split(' ')[0] ?? 'Admin'}
          </h1>
          <p className="mt-1 text-ink-muted">
            {branch ? `${branch.name} branch` : data.settings.centerName} · {formatLongDate(now)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/attendance" variant="ghost">
            <ClipboardCheck aria-hidden />
            Take attendance
          </ButtonLink>
          <Button onClick={() => setPaymentFor('')}>
            <Wallet aria-hidden />
            Record payment
          </Button>
          <Button variant="primary" onClick={() => setAddingStudent(true)}>
            <Plus aria-hidden />
            Add student
          </Button>
        </div>
      </div>

      <KpiStrip
        activeStudents={data.students.filter((s) => s.status === 'active').length}
        activeGroups={data.groups.filter((g) => g.status === 'active').length}
        classes={{
          total: sessions.length,
          recorded: sessions.filter((s) => s.status === 'recorded').length,
          missing: sessions.filter((s) => s.status === 'not_recorded').length,
        }}
        today={todayMarks}
        revenue={revenueInMonth(data, monthKey(now))}
        outstanding={outstandingTotal(balances)}
      />

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <TodayTasks items={attention} balances={balances} onRecordPayment={(id) => setPaymentFor(id)} />
        </div>
        <div className="min-w-0 xl:col-span-4">
          <RecentActivity activity={data.activity} now={now} />
        </div>
      </div>

      <TodayClasses sessions={sessions} now={now} />

      <p className="text-sm text-ink-muted">
        Attendance and revenue trends are in{' '}
        <Link to="/reports" className="font-medium text-brand hover:underline">
          Reports
        </Link>
        .
      </p>

      <StudentFormDialog open={addingStudent} onClose={() => setAddingStudent(false)} />
      <PaymentFormDialog open={paymentFor !== undefined} studentId={paymentFor || undefined} onClose={() => setPaymentFor(undefined)} />
    </div>
  )
}
