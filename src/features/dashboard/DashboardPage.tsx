import { useMemo, useState } from 'react'
import { ClipboardCheck, Plus, Wallet } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { Button, ButtonLink } from '../../components/ui/Button'
import { monthKey, toISODate } from '../../lib/dates'
import { formatLongDate, greeting } from '../../lib/format'
import { outstandingTotal, recordsOn, revenueInMonth, sessionsOn, summarizeMarks } from '../../lib/metrics'
import { useAttention } from '../../hooks/useAttention'
import { can, type Section } from '../../app/permissions'
import { StudentFormDialog } from '../students/StudentFormDialog'
import { PaymentFormDialog } from '../payments/PaymentFormDialog'
import { KpiStrip } from './KpiStrip'
import { RevenueOverview } from './RevenueOverview'
import { NeedsAttention } from './NeedsAttention'
import { attentionRows } from './attention-rows'
import { TodayClasses } from './TodayClasses'
import { tr } from '../../i18n'

/**
 * A calm overview for quick decisions: the key numbers, the income trend,
 * the few things that need doing now, and a short preview of today's classes.
 * Detailed work lives on its own pages (Timetable, Attendance, Payments…),
 * and every number here comes from the same records those pages use.
 */
export function DashboardPage() {
  const { data, now, balances, user, branch } = useSchool()
  const [addingStudent, setAddingStudent] = useState(false)
  // undefined = closed, '' = open without a student, id = open for that student
  const [paymentFor, setPaymentFor] = useState<string | undefined>(undefined)
  const attention = useAttention()

  const allowed = (section: Section) => (user ? can(user.role, section) : false)
  const today = toISODate(now)
  const month = monthKey(now)
  const sessions = useMemo(() => sessionsOn(data, today, now), [data, today, now])
  const todayMarks = useMemo(() => summarizeMarks(recordsOn(data, today)), [data, today])
  const outstanding = outstandingTotal(balances)
  const rows = attentionRows(attention, outstanding.overdueTotal, allowed)
  const showClasses = allowed('schedule') || allowed('attendance')

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink">
            {greeting(now)}, {user?.fullName.split(' ')[0] ?? tr("Admin")}
          </h1>
          <p className="mt-1 text-ink-muted">
            {branch ? tr("{0} branch", branch.name) : data.settings.centerName} · {formatLongDate(now)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {allowed('attendance') && (
            <ButtonLink to="/attendance" variant="ghost">
              <ClipboardCheck aria-hidden />
              {tr("Take attendance")}
            </ButtonLink>
          )}
          {allowed('payments') && (
            <Button onClick={() => setPaymentFor('')}>
              <Wallet aria-hidden />
              {tr("Record payment")}
            </Button>
          )}
          {allowed('students') && (
            <Button variant="primary" onClick={() => setAddingStudent(true)}>
              <Plus aria-hidden />
              {tr("Add student")}
            </Button>
          )}
        </div>
      </div>

      {/* 2. Key numbers, each opening its filtered list */}
      <KpiStrip
        activeStudents={data.students.filter((s) => s.status === 'active').length}
        activeGroups={data.groups.filter((g) => g.status === 'active').length}
        classes={{
          total: sessions.length,
          recorded: sessions.filter((s) => s.status === 'recorded').length,
          missing: sessions.filter((s) => s.status === 'not_recorded').length,
        }}
        today={todayMarks}
        revenue={revenueInMonth(data, month)}
        outstanding={outstanding}
        links={{
          students: allowed('students') ? '/students?status=active' : undefined,
          classes: allowed('schedule') ? '/schedule?view=day' : undefined,
          attendance: allowed('attendance') ? `/attendance?date=${today}` : undefined,
          revenue: allowed('payments') ? `/payments?view=history&month=${month}` : undefined,
          debt: allowed('payments') ? '/payments?view=owing' : undefined,
        }}
      />

      {/* 3. Income trend and 4. what needs doing, side by side on wide screens */}
      <div className="grid gap-6 xl:grid-cols-3">
        {allowed('reports') && <RevenueOverview className="xl:col-span-2" />}
        <NeedsAttention rows={rows} className={allowed('reports') ? undefined : 'xl:col-span-3'} />
      </div>

      {/* 5. A short preview of today; the full day is on the Timetable page */}
      {showClasses && <TodayClasses sessions={sessions} canTakeAttendance={allowed('attendance')} />}

      <StudentFormDialog open={addingStudent} onClose={() => setAddingStudent(false)} />
      <PaymentFormDialog open={paymentFor !== undefined} studentId={paymentFor || undefined} onClose={() => setPaymentFor(undefined)} />
    </div>
  )
}
