import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ClipboardCheck, Plus, Wallet } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { Button, ButtonLink } from '../../components/ui/Button'
import { monthKey, toISODate } from '../../lib/dates'
import { formatLongDate, greeting } from '../../lib/format'
import { outstandingTotal, recordsOn, revenueInMonth, sessionsOn, summarizeMarks } from '../../lib/metrics'
import { StudentFormDialog } from '../students/StudentFormDialog'
import { PaymentFormDialog } from '../payments/PaymentFormDialog'
import { KpiStrip } from './KpiStrip'
import { TodayClasses } from './TodayClasses'
import { WeekTimetable } from '../schedule/WeekTimetable'
import { can } from '../../app/permissions'
import { tr } from '../../i18n'

/**
 * Answers one question: what does the administrator need to know or do today?
 * Numbers first, then this week's timetable (for those who may open
 * Schedule), then today's classes. Trends and
 * charts live on the Reports page.
 */
export function DashboardPage() {
  const { data, now, balances, user, branch } = useSchool()
  const [addingStudent, setAddingStudent] = useState(false)
  // undefined = closed, '' = open without a student, id = open for that student
  const [paymentFor, setPaymentFor] = useState<string | undefined>(undefined)

  const today = toISODate(now)
  const sessions = useMemo(() => sessionsOn(data, today, now), [data, today, now])
  const showTimetable = user ? can(user.role, 'schedule') : false
  const todayMarks = useMemo(() => summarizeMarks(recordsOn(data, today)), [data, today])

  return (
    <div className="space-y-6">
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
          <ButtonLink to="/attendance" variant="ghost">
            <ClipboardCheck aria-hidden />
            {tr("Take attendance")}
          </ButtonLink>
          <Button onClick={() => setPaymentFor('')}>
            <Wallet aria-hidden />
            {tr("Record payment")}
          </Button>
          <Button variant="primary" onClick={() => setAddingStudent(true)}>
            <Plus aria-hidden />
            {tr("Add student")}
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

      {showTimetable && (
        <section aria-labelledby="week-timetable-title" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="week-timetable-title" className="text-[0.9375rem] font-semibold text-ink">
              {tr("This week's timetable")}
            </h2>
            <Link to="/schedule" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              {tr("Open schedule")}
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </div>
          <WeekTimetable showTeacher labelLevel="h3" />
        </section>
      )}

      <TodayClasses sessions={sessions} now={now} />

      <p className="text-sm text-ink-muted">
        {tr("Attendance and revenue trends are in")}{' '}
        <Link to="/reports" className="font-medium text-brand hover:underline">
          {tr("Reports")}
        </Link>
        .
      </p>

      <StudentFormDialog open={addingStudent} onClose={() => setAddingStudent(false)} />
      <PaymentFormDialog open={paymentFor !== undefined} studentId={paymentFor || undefined} onClose={() => setPaymentFor(undefined)} />
    </div>
  )
}
