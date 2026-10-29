import { Link } from 'react-router'
import { CalendarOff } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { ButtonLink } from '../../components/ui/Button'
import { EmptyState, TableScroll, td, th } from '../../components/ui/misc'
import { SessionStatusBadge } from '../../components/StatusBadges'
import { minutesSinceMidnight, timeToMinutes } from '../../lib/dates'
import type { Session, SessionStatus } from '../../lib/metrics'
import { cn } from '../../lib/cn'

const DAY_START = 8 * 60
const DAY_END = 20 * 60 + 30
const HOURS = [8, 10, 12, 14, 16, 18, 20]

const blockStyle: Record<SessionStatus, string> = {
  recorded: 'bg-accent-soft text-accent-ink border-accent/25',
  in_progress: 'bg-accent text-white border-accent',
  upcoming: 'bg-surface text-ink border-line-strong',
  not_recorded: 'bg-danger-soft text-danger border-danger/30',
}

const pct = (minutes: number) => `${((minutes - DAY_START) / (DAY_END - DAY_START)) * 100}%`

/**
 * The school day at a glance: one lane per room, each class a block between
 * 08:00 and 20:30, with a line marking the current time.
 */
function DayRibbon({ sessions, now }: { sessions: Session[]; now: Date }) {
  const rooms = Array.from(new Set(sessions.map((s) => s.group.room))).sort()
  const nowMinutes = minutesSinceMidnight(now)
  const showNow = nowMinutes >= DAY_START && nowMinutes <= DAY_END

  return (
    <div aria-hidden className="relative overflow-x-auto px-5 pb-4">
      <div className="min-w-[720px]">
        <div className="relative ml-28 h-5 text-2xs text-ink-muted">
          {HOURS.map((h) => (
            <span key={h} className="num absolute -translate-x-1/2" style={{ left: pct(h * 60) }}>
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>
        <div className="relative">
          {rooms.map((room) => (
            <div key={room} className="flex h-9 items-center border-t border-line first:border-t-0">
              <span className="w-28 shrink-0 truncate pr-3 text-xs text-ink-muted">{room}</span>
              <div className="relative h-7 flex-1">
                {HOURS.map((h) => (
                  <span key={h} className="absolute top-0 bottom-0 w-px bg-line/70" style={{ left: pct(h * 60) }} />
                ))}
                {sessions
                  .filter((s) => s.group.room === room)
                  .map((s) => {
                    const start = timeToMinutes(s.start)
                    return (
                      <span
                        key={s.group.id}
                        title={`${s.start}–${s.end} ${s.group.name}`}
                        className={cn('absolute top-0 bottom-0 flex items-center overflow-hidden rounded-[5px] border px-2 text-xs font-medium whitespace-nowrap', blockStyle[s.status])}
                        style={{ left: pct(start), width: `calc(${pct(start + s.group.durationMinutes)} - ${pct(start)} - 2px)` }}
                      >
                        <span className="truncate">{s.group.name}</span>
                      </span>
                    )
                  })}
              </div>
            </div>
          ))}
          {showNow && (
            <div className="pointer-events-none absolute top-0 bottom-0 right-0 left-28">
              <div className="absolute top-[-6px] bottom-0 w-0.5 bg-ink" style={{ left: pct(nowMinutes) }}>
                <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-ink" />
              </div>
            </div>
          )}
        </div>
        <ul className="mt-3 ml-28 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          {RIBBON_LEGEND.map(([status, label]) => (
            <li key={status} className="flex items-center gap-1.5">
              <span className={cn('size-2.5 rounded-[3px] border', blockStyle[status])} />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const RIBBON_LEGEND: [SessionStatus, string][] = [
  ['recorded', 'Attendance taken'],
  ['in_progress', 'In progress'],
  ['upcoming', 'Upcoming'],
  ['not_recorded', 'Attendance missing'],
]

export function TodayClasses({ sessions, now }: { sessions: Session[]; now: Date }) {
  const recorded = sessions.filter((s) => s.status === 'recorded').length
  return (
    <Panel
      id="today-classes"
      title="Today’s classes"
      description={sessions.length ? `${sessions.length} classes, ${recorded} with attendance taken` : undefined}
      actions={<ButtonLink to="/schedule" size="sm">Full schedule</ButtonLink>}
      flush
    >
      {sessions.length === 0 ? (
        <EmptyState icon={CalendarOff} title="No classes today">
          Groups meet Monday to Saturday. Enjoy the quiet day.
        </EmptyState>
      ) : (
        <>
          <DayRibbon sessions={sessions} now={now} />
          <TableScroll>
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Classes today with time, group, teacher, room and attendance status</caption>
              <thead className="border-y border-line bg-canvas">
                <tr>
                  <th scope="col" className={th}>Time</th>
                  <th scope="col" className={th}>Group</th>
                  <th scope="col" className={th}>Teacher</th>
                  <th scope="col" className={th}>Room</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sessions.map((s) => (
                  <tr key={s.group.id}>
                    <td className={cn(td, 'num whitespace-nowrap')}>
                      <span className="font-medium text-ink">{s.start}</span>
                      <span className="text-ink-muted">–{s.end}</span>
                    </td>
                    <td className={td}>
                      <p className="font-medium text-ink">{s.group.name}</p>
                      <p className="text-xs text-ink-muted">{s.group.subject}</p>
                    </td>
                    <td className={cn(td, 'text-ink-muted')}>{s.teacher?.fullName ?? 'Unassigned'}</td>
                    <td className={cn(td, 'whitespace-nowrap text-ink-muted')}>{s.group.room}</td>
                    <td className={td}>
                      <SessionStatusBadge status={s.status} />
                    </td>
                    <td className={cn(td, 'text-right')}>
                      {s.status !== 'upcoming' && (
                        <Link to={`/attendance?group=${s.group.id}&date=${s.date}`} className="text-sm font-medium whitespace-nowrap text-accent hover:underline">
                          {s.status === 'recorded' ? 'View' : 'Take attendance'}
                          <span className="sr-only"> for {s.group.name}</span>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      )}
    </Panel>
  )
}
