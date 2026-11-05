import { useMemo } from 'react'
import { CalendarCheck, CalendarDays, CalendarOff, ClipboardCheck, ClipboardList, NotebookPen, Users } from 'lucide-react'
import { useSchool, useUser } from '../../data/school-context'
import { ButtonLink } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { EmptyState } from '../../components/ui/misc'
import { toISODate } from '../../lib/dates'
import { formatLongDate, formatNumber, greeting } from '../../lib/format'
import { sessionsOn } from '../../lib/metrics'
import { homeworkProgress } from '../../lib/performance'
import { StatStrip } from './StatStrip'
import { ClassList } from './ClassList'
import { attendanceTasks } from './teacher-metrics'
import { plural, tr } from '../../i18n'

/** A teacher's day: today's classes, attendance still to take, and the key numbers. */
export function TeacherDashboardPage() {
  const { data, now, branch } = useSchool()
  const user = useUser()
  const today = toISODate(now)

  const activeStudents = data.students.filter((s) => s.status === 'active').length
  const todaySessions = useMemo(() => sessionsOn(data, today, now), [data, today, now])
  const tasks = useMemo(() => attendanceTasks(data, now), [data, now])
  const toEvaluate = useMemo(() => {
    const counts = data.homework.map((h) => homeworkProgress(data, h).toEvaluate)
    return { results: counts.reduce((a, b) => a + b, 0), assignments: counts.filter((n) => n > 0).length }
  }, [data])
  const classesLeft = todaySessions.filter((s) => s.status === 'upcoming' || s.status === 'in_progress').length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink">
            {greeting(now)}, {user.fullName.split(' ')[0]}
          </h1>
          <p className="mt-1 text-ink-muted">
            {branch ? tr("{0} branch", branch.name) : data.settings.centerName}, {formatLongDate(now)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/teacher/schedule" variant="ghost">
            <CalendarDays aria-hidden />
            {tr("My schedule")}
          </ButtonLink>
          <ButtonLink to="/teacher/attendance" variant="primary">
            <ClipboardCheck aria-hidden />
            {tr("Take attendance")}
          </ButtonLink>
        </div>
      </div>

      <StatStrip
        label={tr("Your figures")}
        stats={[
          {
            to: '/teacher/schedule',
            icon: CalendarCheck,
            label: tr("Classes today"),
            value: formatNumber(todaySessions.length),
            detail: todaySessions.length === 0 ? tr("No classes today") : classesLeft === 0 ? tr("All finished for today") : tr("{0} still to come or in progress", classesLeft),
          },
          {
            to: tasks[0] ? `/teacher/attendance?group=${tasks[0].group.id}&date=${tasks[0].date}` : '/teacher/attendance',
            icon: ClipboardList,
            label: tr("Attendance to take"),
            value: formatNumber(tasks.length),
            detail: tasks.length === 0 ? tr("Everything is recorded") : tr("Classes from the last 7 days"),
            tone: tasks.some((t) => t.status === 'not_recorded') ? 'warning' : 'default',
          },
          {
            to: '/teacher/homework?show=to-evaluate',
            icon: NotebookPen,
            label: tr("Homework to evaluate"),
            value: formatNumber(toEvaluate.results),
            detail:
              toEvaluate.results === 0 ? tr("Everything handed in is scored") : tr("Handed in, across {0} {1}", toEvaluate.assignments, plural(toEvaluate.assignments, 'assignment', 'assignments')),
          },
          {
            to: '/teacher/students',
            icon: Users,
            label: tr("Students"),
            value: formatNumber(activeStudents),
            detail: tr("Active in your {0} running groups", data.groups.filter((g) => g.status === 'active').length),
          },
        ]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title={tr("Today’s classes")} description={todaySessions.length ? tr("Open a class once it starts to take attendance.") : undefined} flush>
          {todaySessions.length === 0 ? (
            <EmptyState icon={CalendarOff} title={tr("No classes today")}>
              {tr("Your groups meet Monday to Saturday.")}
            </EmptyState>
          ) : (
            <ClassList label={tr("Today’s classes")} sessions={todaySessions} now={now} action={(s) => (s.status === 'recorded' ? 'View' : 'Take attendance')} />
          )}
        </Panel>

        <Panel title={tr("Attendance to complete")} description={tasks.length ? tr("Started or finished classes without saved attendance.") : undefined} flush>
          {tasks.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title={tr("All caught up")}>
              {tr("Attendance is saved for every class you’ve taught this week.")}
            </EmptyState>
          ) : (
            <ClassList label={tr("Attendance to complete")} sessions={tasks} now={now} withDay action={() => 'Take attendance'} />
          )}
        </Panel>
      </div>
    </div>
  )
}
