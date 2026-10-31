import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Subject } from '../../types'
import { SUBJECTS } from '../../types'
import { useSchool } from '../../data/school-context'
import { usePortalPath } from '../../app/portal'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button, IconButton } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { RangeToggle } from '../../components/ui/RangeToggle'
import { EmptyState } from '../../components/ui/misc'
import { SessionStatusBadge } from '../../components/StatusBadges'
import { addDays, isoWeekday, startOfWeek, toISODate } from '../../lib/dates'
import { formatDayShort, formatLongDate } from '../../lib/format'
import { sessionsOn, type Session, type SessionStatus } from '../../lib/metrics'
import { cn } from '../../lib/cn'

/** Each subject gets a quiet colour on the left edge of its classes. */
const subjectColor: Record<Subject, string> = {
  English: 'border-l-cat-green',
  'IELTS Preparation': 'border-l-cat-blue',
  Mathematics: 'border-l-cat-orange',
  'Computer Science': 'border-l-cat-plum',
}
const subjectSwatch: Record<Subject, string> = {
  English: 'bg-cat-green',
  'IELTS Preparation': 'bg-cat-blue',
  Mathematics: 'bg-cat-orange',
  'Computer Science': 'bg-cat-plum',
}

const statusNote: Record<SessionStatus, [string, string]> = {
  upcoming: ['Upcoming', 'text-ink-faint'],
  recorded: ['Attendance taken', 'text-success'],
  not_recorded: ['Attendance missing', 'text-danger'],
  in_progress: ['In progress', 'text-brand'],
}

const studentCount = (n: number) => `${n} ${n === 1 ? 'student' : 'students'}`

function SessionCard({ s, compact, showTeacher }: { s: Session; compact?: boolean; showTeacher: boolean }) {
  const portalPath = usePortalPath()
  const note = statusNote[s.status]
  const body = (
    <>
      <p className="truncate text-sm font-medium text-ink">{s.group.name}</p>
      <p className="truncate text-xs text-ink-muted">{showTeacher ? (s.teacher?.fullName ?? 'No teacher') : s.group.subject}</p>
      <p className="num truncate text-xs text-ink-muted">
        {compact ? `${s.start}–${s.end}, ` : ''}
        {s.group.room}, {studentCount(s.enrolled)}
      </p>
      <p className={cn('mt-1 text-xs font-medium', note[1])}>{note[0]}</p>
    </>
  )
  const className = cn('block rounded-[6px] border border-line border-l-[3px] bg-surface px-2.5 py-2', subjectColor[s.group.subject])
  // Past and current classes link to their attendance sheet.
  return s.status === 'upcoming' ? (
    <div className={className}>{body}</div>
  ) : (
    <Link to={portalPath(`/attendance?group=${s.group.id}&date=${s.date}`)} className={cn(className, 'hover:border-line-strong hover:bg-canvas')}>
      {body}
      <span className="sr-only">, open attendance</span>
    </Link>
  )
}

type View = 'week' | 'day'

export function SchedulePage() {
  const { data, now, user } = useSchool()
  const isTeacher = user?.role === 'teacher'
  // Day view starts on today, or on Sunday (no classes) on the coming Monday.
  const sunday = isoWeekday(now) === 7
  const home = { week: sunday ? 1 : 0, index: sunday ? 0 : isoWeekday(now) - 1 }
  const [view, setView] = useState<View>(isTeacher ? 'day' : 'week')
  const [weekOffset, setWeekOffset] = useState(view === 'day' ? home.week : 0)
  // Day of the week shown in day view, 0 = Monday.
  const [dayIndex, setDayIndex] = useState(home.index)
  const [teacherId, setTeacherId] = useState('')
  const [subject, setSubject] = useState('')

  const monday = addDays(startOfWeek(now), weekOffset * 7)
  const days = Array.from({ length: 6 }, (_, i) => addDays(monday, i))
  const today = toISODate(now)

  const week = days.map((day) => ({
    day,
    date: toISODate(day),
    sessions: sessionsOn(data, toISODate(day), now).filter((s) => (!teacherId || s.group.teacherId === teacherId) && (!subject || s.group.subject === subject)),
  }))

  const slots = Array.from(new Set(week.flatMap((d) => d.sessions.map((s) => s.start)))).sort()
  const total = week.reduce((sum, d) => sum + d.sessions.length, 0)
  const weekLabel = `${formatDayShort(days[0])} – ${formatDayShort(days[5])}`
  const selectedDay = week[dayIndex]

  // Day view steps one day at a time, rolling over into the next or previous week.
  const stepDay = (delta: number) => {
    const next = dayIndex + delta
    if (next < 0) {
      setWeekOffset((w) => w - 1)
      setDayIndex(5)
    } else if (next > 5) {
      setWeekOffset((w) => w + 1)
      setDayIndex(0)
    } else setDayIndex(next)
  }
  const step = (delta: number) => (view === 'week' ? setWeekOffset((w) => w + delta) : stepDay(delta))
  const isCurrent = view === 'week' ? weekOffset === 0 : weekOffset === home.week && dayIndex === home.index
  const goToday = () => {
    setWeekOffset(view === 'week' ? 0 : home.week)
    setDayIndex(home.index)
  }

  return (
    <>
      <PageHeader
        title={isTeacher ? 'My schedule' : 'Schedule'}
        description={
          isTeacher
            ? 'Your classes only. Open a class that has started to take attendance.'
            : 'The weekly timetable of running groups. Odd-day groups meet Mon, Wed, Fri; even-day groups meet Tue, Thu, Sat.'
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <RangeToggle<View>
            label="Schedule view"
            value={view}
            onChange={setView}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
            ]}
          />
          <IconButton label={view === 'week' ? 'Previous week' : 'Previous day'} onClick={() => step(-1)} className="border border-line-strong bg-surface">
            <ChevronLeft />
          </IconButton>
          <IconButton label={view === 'week' ? 'Next week' : 'Next day'} onClick={() => step(1)} className="border border-line-strong bg-surface">
            <ChevronRight />
          </IconButton>
          <h2 className="num ml-1 font-semibold text-ink" aria-live="polite">
            {view === 'week' ? weekLabel : formatLongDate(selectedDay.day)}
          </h2>
          {!isCurrent && (
            <Button size="sm" variant="ghost" onClick={goToday}>
              {view === 'week' ? 'This week' : sunday ? 'Monday' : 'Today'}
            </Button>
          )}
        </div>
        <div className={cn('grid gap-3 sm:flex', isTeacher ? 'grid-cols-1' : 'grid-cols-2')}>
          {!isTeacher && (
            <Select aria-label="Filter by teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="sm:w-52">
              <option value="">All teachers</option>
              {data.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </Select>
          )}
          <Select aria-label="Filter by subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="sm:w-48">
            <option value="">All subjects</option>
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
      </div>

      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted" aria-label="Subject colours">
        {SUBJECTS.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span aria-hidden className={cn('h-3 w-1 rounded-full', subjectSwatch[s])} />
            {s}
          </li>
        ))}
        <li className="num ml-auto">
          {view === 'week' ? `${total} classes this week` : `${selectedDay.sessions.length} ${selectedDay.sessions.length === 1 ? 'class' : 'classes'} this day`}
        </li>
      </ul>

      {view === 'day' ? (
        <DayView sessions={selectedDay.sessions} showTeacher={!isTeacher} />
      ) : (
        <>
          {/* Desktop: time slots down, days across */}
          <div className="relative hidden overflow-x-auto rounded-panel border border-line bg-surface md:block">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-sm">
              <caption className="sr-only">Classes for the week of {weekLabel}</caption>
              <thead>
                <tr className="border-b border-line bg-canvas">
                  <th scope="col" className="w-20 px-3 py-2.5 text-left text-xs font-medium text-ink-muted">
                    Time
                  </th>
                  {week.map(({ day, date }) => (
                    <th key={date} scope="col" className={cn('px-2 py-2.5 text-left text-xs font-medium', date === today ? 'text-brand-ink' : 'text-ink-muted')}>
                      {day.toLocaleDateString('en-GB', { weekday: 'long' })}
                      <span className={cn('num ml-1.5', date === today ? 'rounded bg-brand px-1.5 py-0.5 text-white' : 'text-ink-faint')}>{day.getDate()}</span>
                      {date === today && <span className="sr-only"> (today)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {slots.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-ink-muted">
                      No classes match these filters this week.
                    </td>
                  </tr>
                ) : (
                  slots.map((slot) => (
                    <tr key={slot}>
                      <th scope="row" className="num px-3 py-2 text-left align-top text-sm font-medium text-ink">
                        {slot}
                      </th>
                      {week.map(({ date, sessions }) => (
                        <td key={date} className={cn('px-1.5 py-1.5 align-top', date === today && 'bg-brand-soft/40')}>
                          <div className="space-y-1.5">
                            {sessions
                              .filter((s) => s.start === slot)
                              .map((s) => (
                                <SessionCard key={s.group.id} s={s} showTeacher={!isTeacher} />
                              ))}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: one list per day */}
          <div className="space-y-4 md:hidden">
            {week.map(({ day, date, sessions }) => (
              <section key={date} aria-label={day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}>
                <h3 className={cn('mb-2 text-sm font-semibold', date === today ? 'text-brand-ink' : 'text-ink')}>
                  {formatDayShort(day)}
                  {date === today && ' (today)'}
                </h3>
                {sessions.length === 0 ? (
                  <p className="rounded-panel border border-dashed border-line px-4 py-3 text-sm text-ink-muted">No classes</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s) => (
                      <SessionCard key={s.group.id} s={s} compact showTeacher={!isTeacher} />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  )
}

/** One day as a list: time, group, subject, room, students and status. */
function DayView({ sessions, showTeacher }: { sessions: Session[]; showTeacher: boolean }) {
  const portalPath = usePortalPath()
  if (sessions.length === 0) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        <EmptyState icon={CalendarOff} title="No classes this day">
          Groups meet Monday to Saturday. Use the arrows to move to another day.
        </EmptyState>
      </div>
    )
  }
  return (
    <ul className="divide-y divide-line rounded-panel border border-line bg-surface" aria-label="Classes this day">
      {sessions.map((s) => (
        <li key={s.group.id} className={cn('flex flex-col gap-3 border-l-[3px] px-5 py-4 sm:flex-row sm:items-center sm:gap-6', subjectColor[s.group.subject])}>
          <div className="num w-28 shrink-0 text-sm">
            <p className="font-semibold text-ink">{s.start}</p>
            <p className="text-ink-muted">to {s.end}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{s.group.name}</p>
            <p className="num truncate text-sm text-ink-muted">
              {s.group.subject}
              {showTeacher && `, ${s.teacher?.fullName ?? 'no teacher'}`} · {s.group.room} · {studentCount(s.enrolled)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SessionStatusBadge status={s.status} />
            {s.status !== 'upcoming' && (
              <Link to={portalPath(`/attendance?group=${s.group.id}&date=${s.date}`)} className="text-sm font-medium text-brand hover:underline">
                {s.status === 'recorded' ? 'View attendance' : 'Take attendance'}
                <span className="sr-only"> for {s.group.name}</span>
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
