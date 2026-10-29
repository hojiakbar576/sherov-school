import { useMemo, useState } from 'react'
import { ClipboardCheck, Plus, Wallet } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { useAttention } from '../../hooks/useAttention'
import { Button, ButtonLink } from '../../components/ui/Button'
import { monthKey, toISODate } from '../../lib/dates'
import { formatLongDate, greeting } from '../../lib/format'
import { outstandingTotal, revenueInMonth, sessionsOn, weekAttendance } from '../../lib/metrics'
import { StudentFormDialog } from '../students/StudentFormDialog'
import { PaymentFormDialog } from '../payments/PaymentFormDialog'
import { KpiStrip } from './KpiStrip'
import { TodayClasses } from './TodayClasses'
import { AttendanceOverview } from './AttendanceOverview'
import { RevenueOverview } from './RevenueOverview'
import { NeedsAttention } from './NeedsAttention'
import { RecentActivity } from './RecentActivity'

export function DashboardPage() {
  const { data, now, balances } = useSchool()
  const attention = useAttention()
  const [addingStudent, setAddingStudent] = useState(false)
  // undefined = closed, '' = open without a student, id = open for that student
  const [paymentFor, setPaymentFor] = useState<string | undefined>(undefined)

  const today = toISODate(now)
  const week = useMemo(() => weekAttendance(data, now), [data, now])
  const sessions = useMemo(() => sessionsOn(data, today, now), [data, today, now])
  const todaySummary = week.find((d) => d.date === today) ?? {
    present: 0, late: 0, absent: 0, total: 0, rate: null, sessionsPlanned: 0, sessionsRecorded: 0,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink">{greeting(now)}, Admin</h1>
          <p className="mt-1 text-ink-muted">
            Here’s what’s happening at {data.settings.centerName} today, {formatLongDate(now)}.
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
        today={todaySummary}
        revenue={revenueInMonth(data, monthKey(now))}
        outstanding={outstandingTotal(balances)}
      />

      <TodayClasses sessions={sessions} now={now} />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <AttendanceOverview days={week} />
        </div>
        <div className="min-w-0 xl:col-span-5">
          <RevenueOverview />
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <NeedsAttention items={attention} onRecordPayment={(id) => setPaymentFor(id)} />
        </div>
        <div className="min-w-0 xl:col-span-5">
          <RecentActivity activity={data.activity} now={now} />
        </div>
      </div>

      <StudentFormDialog open={addingStudent} onClose={() => setAddingStudent(false)} />
      <PaymentFormDialog open={paymentFor !== undefined} studentId={paymentFor || undefined} onClose={() => setPaymentFor(undefined)} />
    </div>
  )
}
