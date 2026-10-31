import { Link } from 'react-router'
import { SessionStatusBadge } from '../../components/StatusBadges'
import { atTime, toISODate } from '../../lib/dates'
import { formatDayShort } from '../../lib/format'
import type { Session } from '../../lib/metrics'

interface ClassListProps {
  sessions: Session[]
  now: Date
  /** Show the day as well as the time (for lists that span several days). */
  withDay?: boolean
  /** What the row's link says, if anything, for a class that has started. */
  action?: (s: Session) => string | null
  label: string
}

/** A compact list of a teacher's classes with time, room, students and status. */
export function ClassList({ sessions, now, withDay, action, label }: ClassListProps) {
  const today = toISODate(now)
  return (
    <ul className="divide-y divide-line border-t border-line" aria-label={label}>
      {sessions.map((s) => {
        const linkText = s.status === 'upcoming' ? null : (action?.(s) ?? null)
        return (
          <li key={`${s.group.id}-${s.date}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            <div className="num w-24 shrink-0 text-sm">
              {withDay && <p className="text-xs text-ink-muted">{s.date === today ? 'Today' : formatDayShort(atTime(s.date, s.start))}</p>}
              <p className="font-medium text-ink">
                {s.start}–{s.end}
              </p>
            </div>
            <div className="min-w-0 flex-1 basis-40">
              <p className="truncate text-sm font-medium text-ink">{s.group.name}</p>
              <p className="num truncate text-xs text-ink-muted">
                {s.group.room} · {s.enrolled} {s.enrolled === 1 ? 'student' : 'students'}
              </p>
            </div>
            <SessionStatusBadge status={s.status} />
            {linkText && (
              <Link to={`/teacher/attendance?group=${s.group.id}&date=${s.date}`} className="text-sm font-medium whitespace-nowrap text-brand hover:underline">
                {linkText}
                <span className="sr-only">
                  {' '}
                  for {s.group.name}, {s.date}
                </span>
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
