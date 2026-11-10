import { Link } from 'react-router'
import { CalendarOff } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { ButtonLink } from '../../components/ui/Button'
import { EmptyState, TableScroll, td, th } from '../../components/ui/misc'
import { SessionStatusBadge } from '../../components/StatusBadges'
import { timeToMinutes } from '../../lib/dates'
import type { Session, SessionStatus } from '../../lib/metrics'
import { cn } from '../../lib/cn'
import { tr } from '../../i18n'

/** The dashboard shows a preview only; the full day is on the Timetable page. */
const MAX_ROWS = 8

// What matters most right now: running classes, then ones still missing attendance, then the next ones.
const PRIORITY: Record<SessionStatus, number> = { in_progress: 0, not_recorded: 1, upcoming: 2, recorded: 3 }

/** The classes worth showing: the most relevant ones, listed in time order. */
function previewClasses(sessions: Session[], max = MAX_ROWS): Session[] {
  return [...sessions]
    .sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status] || timeToMinutes(a.start) - timeToMinutes(b.start))
    .slice(0, max)
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
}

interface TodayClassesProps {
  sessions: Session[]
  /** Whether the person may open attendance sheets (otherwise no attendance links). */
  canTakeAttendance: boolean
}

export function TodayClasses({ sessions, canTakeAttendance }: TodayClassesProps) {
  const recorded = sessions.filter((s) => s.status === 'recorded').length
  const shown = previewClasses(sessions)
  return (
    <Panel
      id="today-classes"
      title={tr("Today’s classes")}
      description={sessions.length ? tr("{0} classes, {1} with attendance taken", sessions.length, recorded) : undefined}
      actions={
        <ButtonLink to="/schedule?view=day" size="sm">
          {tr("Open timetable")}
        </ButtonLink>
      }
      flush
    >
      {sessions.length === 0 ? (
        <EmptyState icon={CalendarOff} title={tr("No classes today")}>
          {tr("Groups meet Monday to Saturday. Enjoy the quiet day.")}
        </EmptyState>
      ) : (
        <>
          <TableScroll>
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">{tr("Classes today with time, group, teacher, room and attendance status")}</caption>
              <thead className="border-y border-line bg-canvas">
                <tr>
                  <th scope="col" className={th}>{tr("Time")}</th>
                  <th scope="col" className={th}>{tr("Group")}</th>
                  <th scope="col" className={th}>{tr("Teacher")}</th>
                  <th scope="col" className={th}>{tr("Room")}</th>
                  <th scope="col" className={th}>{tr("Status")}</th>
                  {canTakeAttendance && (
                    <th scope="col" className={th}>
                      <span className="sr-only">{tr("Action")}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((s) => (
                  <tr key={s.group.id}>
                    <td className={cn(td, 'num whitespace-nowrap')}>
                      <span className="font-medium text-ink">{s.start}</span>
                      <span className="text-ink-muted">–{s.end}</span>
                    </td>
                    <td className={td}>
                      <p className="font-medium text-ink">{s.group.name}</p>
                      <p className="text-xs text-ink-muted">{s.group.subject}</p>
                    </td>
                    <td className={cn(td, 'text-ink-muted')}>{s.teacher?.fullName ?? tr("Unassigned")}</td>
                    <td className={cn(td, 'whitespace-nowrap text-ink-muted')}>{s.group.room}</td>
                    <td className={td}>
                      <SessionStatusBadge status={s.status} />
                    </td>
                    {canTakeAttendance && (
                      <td className={cn(td, 'text-right')}>
                        {s.status !== 'upcoming' && (
                          <Link to={`/attendance?group=${s.group.id}&date=${s.date}`} className="text-sm font-medium whitespace-nowrap text-brand hover:underline">
                            {s.status === 'recorded' ? tr("View") : tr("Take attendance")}
                            <span className="sr-only">{' '}{tr("for")}{' '}{s.group.name}</span>
                          </Link>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          {sessions.length > shown.length && (
            <p className="border-t border-line px-5 py-2.5 text-xs text-ink-muted">
              {tr("Showing {0} of {1} classes.", shown.length, sessions.length)}{' '}
              <Link to="/schedule?view=day" className="font-medium text-brand hover:underline">
                {tr("See the whole day in the timetable")}
              </Link>
            </p>
          )}
        </>
      )}
    </Panel>
  )
}
