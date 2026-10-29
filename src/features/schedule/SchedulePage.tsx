import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Subject } from '../../types'
import { SUBJECTS } from '../../types'
import { useSchool } from '../../data/school-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button, IconButton } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { addDays, startOfWeek, toISODate } from '../../lib/dates'
import { formatDayShort } from '../../lib/format'
import { sessionsOn, type Session, type SessionStatus } from '../../lib/metrics'
import { cn } from '../../lib/cn'

/** Each subject gets a quiet colour on the left edge of its classes. */
const subjectColor: Record<Subject, string> = {
  English: 'border-l-[#4F46E5]',
  'IELTS Preparation': 'border-l-[#0E7490]',
  Mathematics: 'border-l-[#C2410C]',
  'Computer Science': 'border-l-[#2F7A55]',
}
const subjectSwatch: Record<Subject, string> = {
  English: 'bg-[#4F46E5]',
  'IELTS Preparation': 'bg-[#0E7490]',
  Mathematics: 'bg-[#C2410C]',
  'Computer Science': 'bg-[#2F7A55]',
}

const statusNote: Partial<Record<SessionStatus, [string, string]>> = {
  recorded: ['Attendance taken', 'text-success'],
  not_recorded: ['Attendance missing', 'text-danger'],
  in_progress: ['In progress', 'text-accent'],
}

function SessionCard({ s, compact }: { s: Session; compact?: boolean }) {
  const note = statusNote[s.status]
  const body = (
    <>
      <p className="truncate text-sm font-medium text-ink">{s.group.name}</p>
      <p className="truncate text-xs text-ink-muted">{s.teacher?.fullName ?? 'No teacher'}</p>
      <p className="num truncate text-xs text-ink-muted">
        {compact ? `${s.start}–${s.end}, ` : ''}
        {s.group.room}
      </p>
      {note && <p className={cn('mt-1 text-xs font-medium', note[1])}>{note[0]}</p>}
    </>
  )
  const className = cn('block rounded-[6px] border border-line border-l-[3px] bg-surface px-2.5 py-2', subjectColor[s.group.subject])
  // Past and current classes link to their attendance sheet.
  return s.status === 'upcoming' ? (
    <div className={className}>{body}</div>
  ) : (
    <Link to={`/attendance?group=${s.group.id}&date=${s.date}`} className={cn(className, 'hover:border-line-strong hover:bg-canvas')}>
      {body}
      <span className="sr-only">, open attendance</span>
    </Link>
  )
}

export function SchedulePage() {
  const { data, now } = useSchool()
  const [weekOffset, setWeekOffset] = useState(0)
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

  return (
    <>
      <PageHeader title="Schedule" description="The weekly timetable of running groups. Odd-day groups meet Mon, Wed, Fri; even-day groups meet Tue, Thu, Sat." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <IconButton label="Previous week" onClick={() => setWeekOffset((w) => w - 1)} className="border border-line-strong bg-surface">
            <ChevronLeft />
          </IconButton>
          <IconButton label="Next week" onClick={() => setWeekOffset((w) => w + 1)} className="border border-line-strong bg-surface">
            <ChevronRight />
          </IconButton>
          <h2 className="num ml-1 font-semibold text-ink" aria-live="polite">
            {weekLabel}
          </h2>
          {weekOffset !== 0 && (
            <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>
              This week
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select aria-label="Filter by teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="sm:w-52">
            <option value="">All teachers</option>
            {data.teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
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
        <li className="num ml-auto">{total} classes this week</li>
      </ul>

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
                <th key={date} scope="col" className={cn('px-2 py-2.5 text-left text-xs font-medium', date === today ? 'text-accent-ink' : 'text-ink-muted')}>
                  {day.toLocaleDateString('en-GB', { weekday: 'long' })}
                  <span className={cn('num ml-1.5', date === today ? 'rounded bg-accent px-1.5 py-0.5 text-white' : 'text-ink-faint')}>{day.getDate()}</span>
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
                    <td key={date} className={cn('px-1.5 py-1.5 align-top', date === today && 'bg-accent-soft/40')}>
                      <div className="space-y-1.5">
                        {sessions
                          .filter((s) => s.start === slot)
                          .map((s) => (
                            <SessionCard key={s.group.id} s={s} />
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
            <h3 className={cn('mb-2 text-sm font-semibold', date === today ? 'text-accent-ink' : 'text-ink')}>
              {formatDayShort(day)}
              {date === today && ' (today)'}
            </h3>
            {sessions.length === 0 ? (
              <p className="rounded-panel border border-dashed border-line px-4 py-3 text-sm text-ink-muted">No classes</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <SessionCard key={s.group.id} s={s} compact />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  )
}
