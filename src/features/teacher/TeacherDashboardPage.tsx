import { useMemo } from 'react'
import { Link } from 'react-router'
import { BellOff, CalendarCheck, CalendarDays, CalendarOff, ClipboardCheck, ClipboardList, Users, UsersRound } from 'lucide-react'
import { useSchool, useUser } from '../../data/school-context'
import { ButtonLink } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { EmptyState } from '../../components/ui/misc'
import { toISODate } from '../../lib/dates'
import { formatLongDate, formatNumber, formatRelative, greeting } from '../../lib/format'
import { sessionsOn } from '../../lib/metrics'
import { notificationIcon, notificationKindLabel, teacherNotifications } from '../../lib/notifications'
import { cn } from '../../lib/cn'
import { StatStrip } from './StatStrip'
import { ClassList } from './ClassList'
import { attendanceTasks, upcomingClasses } from './teacher-metrics'

export function TeacherDashboardPage() {
  const { data, now, branch } = useSchool()
  const user = useUser()
  const today = toISODate(now)

  const runningGroups = data.groups.filter((g) => g.status === 'active')
  const activeStudents = data.students.filter((s) => s.status === 'active').length
  const todaySessions = useMemo(() => sessionsOn(data, today, now), [data, today, now])
  const tasks = useMemo(() => attendanceTasks(data, now), [data, now])
  const upcoming = useMemo(() => upcomingClasses(data, now, 5), [data, now])
  const notifications = useMemo(() => teacherNotifications(data, now).slice(0, 5), [data, now])
  const read = new Set(data.notificationReads[user.id])
  const unread = notifications.filter((n) => !read.has(n.id)).length
  const classesLeft = todaySessions.filter((s) => s.status === 'upcoming' || s.status === 'in_progress').length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink">
            {greeting(now)}, {user.fullName.split(' ')[0]}
          </h1>
          <p className="mt-1 text-ink-muted">
            {branch ? `${branch.name} branch` : data.settings.centerName}, {formatLongDate(now)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/teacher/schedule" variant="ghost">
            <CalendarDays aria-hidden />
            My schedule
          </ButtonLink>
          <ButtonLink to="/teacher/attendance" variant="primary">
            <ClipboardCheck aria-hidden />
            Take attendance
          </ButtonLink>
        </div>
      </div>

      <StatStrip
        label="Your figures"
        stats={[
          { to: '/teacher/groups', icon: UsersRound, label: 'My groups', value: formatNumber(runningGroups.length), detail: data.groups.length === runningGroups.length ? 'All running' : `${data.groups.length - runningGroups.length} paused or finished` },
          { to: '/teacher/students', icon: Users, label: 'Students', value: formatNumber(activeStudents), detail: 'Active in your groups' },
          {
            to: '/teacher/schedule',
            icon: CalendarCheck,
            label: 'Classes today',
            value: formatNumber(todaySessions.length),
            detail: todaySessions.length === 0 ? 'No classes today' : classesLeft === 0 ? 'All finished for today' : `${classesLeft} still to come or in progress`,
          },
          {
            to: tasks[0] ? `/teacher/attendance?group=${tasks[0].group.id}&date=${tasks[0].date}` : '/teacher/attendance',
            icon: ClipboardList,
            label: 'Attendance to take',
            value: formatNumber(tasks.length),
            detail: tasks.length === 0 ? 'Everything is recorded' : 'Classes from the last 7 days',
            tone: tasks.some((t) => t.status === 'not_recorded') ? 'warning' : 'default',
          },
        ]}
      />

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 space-y-6 xl:col-span-7">
          <Panel title="Today’s classes" description={todaySessions.length ? 'Open a class once it starts to take attendance.' : undefined} flush>
            {todaySessions.length === 0 ? (
              <EmptyState icon={CalendarOff} title="No classes today">
                Your groups meet Monday to Saturday.
              </EmptyState>
            ) : (
              <ClassList
                label="Today’s classes"
                sessions={todaySessions}
                now={now}
                action={(s) => (s.status === 'recorded' ? 'View' : 'Take attendance')}
              />
            )}
          </Panel>

          <Panel title="Attendance to complete" description={tasks.length ? 'Started or finished classes without saved attendance.' : undefined} flush>
            {tasks.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="All caught up">
                Attendance is saved for every class you’ve taught this week.
              </EmptyState>
            ) : (
              <ClassList label="Attendance to complete" sessions={tasks} now={now} withDay action={() => 'Take attendance'} />
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6 xl:col-span-5">
          <Panel title="Coming up" flush>
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarOff} title="Nothing scheduled">
                No classes in the next week.
              </EmptyState>
            ) : (
              <ClassList label="Upcoming classes" sessions={upcoming} now={now} withDay />
            )}
          </Panel>

          <Panel
            title="Recent notifications"
            description={unread ? `${unread} unread` : undefined}
            actions={
              <Link to="/teacher/notifications" className="text-sm font-medium text-brand hover:underline">
                See all
              </Link>
            }
            flush
          >
            {notifications.length === 0 ? (
              <EmptyState icon={BellOff} title="No notifications" />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {notifications.map((n) => {
                  const Icon = notificationIcon[n.kind]
                  const isUnread = !read.has(n.id)
                  return (
                    <li key={n.id} className="flex gap-3 px-5 py-3">
                      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-ink-muted">
                          {notificationKindLabel[n.kind]} · {formatRelative(n.createdAt, now)}
                        </p>
                        <p className={cn('text-sm text-ink', isUnread && 'font-semibold')}>{n.title}</p>
                        <p className="line-clamp-2 text-xs text-ink-muted">{n.body}</p>
                      </div>
                      {isUnread && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />}
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
