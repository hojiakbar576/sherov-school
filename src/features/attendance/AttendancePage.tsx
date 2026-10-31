import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CalendarOff, Check, ChevronLeft, ChevronRight, ClipboardCheck, History, Lock, MessageSquarePlus, Users } from 'lucide-react'
import type { AttendanceMark, Group, Student } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { Button, IconButton } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Avatar, EmptyState } from '../../components/ui/misc'
import { SessionStatusBadge } from '../../components/StatusBadges'
import { addDays, isValidISODate, parseISODate, toISODate } from '../../lib/dates'
import { attendanceMarkLabel, formatDate, formatLongDate, formatPercent, formatRelative } from '../../lib/format'
import { findRecord, groupRoster, sessionsOn, summarizeMarks, type Session } from '../../lib/metrics'
import { cn } from '../../lib/cn'

const MARKS: AttendanceMark[] = ['present', 'late', 'absent']
const markStyle: Record<AttendanceMark, string> = {
  present: 'peer-checked:bg-success peer-checked:text-white peer-checked:border-success',
  late: 'peer-checked:bg-warning-mark peer-checked:text-ink peer-checked:border-warning-mark',
  absent: 'peer-checked:bg-danger peer-checked:text-white peer-checked:border-danger',
}

/** Picks the session most likely to need attention on this date. */
function defaultSession(sessions: Session[]): Session | undefined {
  return (
    sessions.find((s) => s.status === 'in_progress') ??
    sessions.find((s) => s.status === 'not_recorded') ??
    sessions.find((s) => s.status === 'upcoming') ??
    sessions[0]
  )
}

export function AttendancePage() {
  const { data, now, user } = useSchool()
  const isTeacher = user?.role === 'teacher'
  const [params, setParams] = useSearchParams()
  const today = toISODate(now)
  const date = isValidISODate(params.get('date')) ? params.get('date')! : today
  const sessions = useMemo(() => sessionsOn(data, date, now), [data, date, now])
  const requested = params.get('group')
  // A class someone can't see (another teacher's, or another branch's) is never opened.
  const notAllowed = requested !== null && !data.groups.some((g) => g.id === requested)
  const selected = sessions.find((s) => s.group.id === requested) ?? (notAllowed ? undefined : defaultSession(sessions))

  const go = (next: { date?: string; group?: string }) => {
    const p = new URLSearchParams()
    p.set('date', next.date ?? date)
    if (next.group) p.set('group', next.group)
    setParams(p, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        description={
          isTeacher
            ? 'Choose one of your classes, mark each student, add a note if needed, then save.'
            : 'Choose a class, mark each student, then save. Saved attendance updates the dashboard straight away.'
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Panel title="Classes" description={formatLongDate(parseISODate(date))} flush>
          <div className="flex items-center gap-2 px-5 pb-4">
            <IconButton label="Previous day" onClick={() => go({ date: toISODate(addDays(parseISODate(date), -1)) })} className="border border-line-strong">
              <ChevronLeft />
            </IconButton>
            <Input type="date" aria-label="Date" value={date} max={today} onChange={(e) => isValidISODate(e.target.value) && go({ date: e.target.value })} />
            <IconButton
              label="Next day"
              onClick={() => go({ date: toISODate(addDays(parseISODate(date), 1)) })}
              disabled={date >= today}
              className="border border-line-strong disabled:opacity-40"
            >
              <ChevronRight />
            </IconButton>
          </div>
          {date !== today && (
            <div className="px-5 pb-3">
              <Button size="sm" variant="ghost" onClick={() => go({ date: today })}>
                Back to today
              </Button>
            </div>
          )}
          {sessions.length === 0 ? (
            <EmptyState icon={CalendarOff} title="No classes on this day">
              Groups meet Monday to Saturday.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line" aria-label="Classes on this day">
              {sessions.map((s) => {
                const current = s.group.id === selected?.group.id
                return (
                  <li key={s.group.id}>
                    <button
                      type="button"
                      aria-current={current ? 'true' : undefined}
                      onClick={() => go({ group: s.group.id })}
                      className={cn('flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-canvas', current && 'bg-brand-soft hover:bg-brand-soft')}
                    >
                      <span className="num w-11 shrink-0 pt-0.5 text-sm font-medium text-ink">{s.start}</span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-sm font-medium', current ? 'text-brand-ink' : 'text-ink')}>{s.group.name}</span>
                        <span className="mt-1 block">
                          <SessionStatusBadge status={s.status} />
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        {notAllowed ? (
          <div className="rounded-panel border border-line bg-surface">
            <EmptyState icon={Lock} title="This class isn’t yours">
              {isTeacher
                ? 'You can only see and record attendance for groups you teach. Pick one of your classes from the list.'
                : 'This group belongs to another branch. Pick one of your branch’s classes from the list.'}
            </EmptyState>
          </div>
        ) : selected ? (
          <div className="min-w-0 space-y-6">
            {/* key: start fresh when switching class or date */}
            <Roster key={`${selected.group.id}-${date}`} session={selected} date={date} isFuture={date > today || selected.status === 'upcoming'} />
            <RecentRecords group={selected.group} current={date} onOpen={(d) => go({ date: d, group: selected.group.id })} />
          </div>
        ) : (
          <div className="rounded-panel border border-line bg-surface">
            <EmptyState icon={ClipboardCheck} title="Pick a day with classes">
              Use the date picker to find a class to mark.
            </EmptyState>
          </div>
        )}
      </div>
    </>
  )
}

function Roster({ session, date, isFuture }: { session: Session; date: string; isFuture: boolean }) {
  const { data, now, actions, user } = useSchool()
  const toast = useToast()
  const record = findRecord(data, session.group.id, date)
  const [comments, setComments] = useState<Record<string, string>>(() => ({ ...record?.comments }))
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({})

  // Current students, plus anyone marked earlier who has since left the group.
  const students = useMemo(() => {
    const roster = groupRoster(data, session.group.id, date)
    const extra = record ? Object.keys(record.marks).filter((id) => !roster.some((s) => s.id === id)) : []
    const others = extra.map((id) => data.students.find((s) => s.id === id)).filter((s): s is Student => Boolean(s))
    return [...roster, ...others]
  }, [data, session.group.id, date, record])

  const [marks, setMarks] = useState<Record<string, AttendanceMark>>(() =>
    Object.fromEntries(students.map((s) => [s.id, record?.marks[s.id] ?? 'present'])),
  )
  const [dirty, setDirty] = useState(false)

  const setMark = (id: string, mark: AttendanceMark) => {
    setMarks((m) => ({ ...m, [id]: mark }))
    setDirty(true)
  }

  const counts = MARKS.map((m) => [m, students.filter((s) => marks[s.id] === m).length] as const)

  const setComment = (id: string, text: string) => {
    setComments((c) => ({ ...c, [id]: text }))
    setDirty(true)
  }

  const save = () => {
    const toSave = Object.fromEntries(students.map((s) => [s.id, marks[s.id] ?? 'present']))
    if (!actions.saveAttendance(session.group.id, date, toSave, comments)) {
      toast.show('Attendance wasn’t saved: you can only record attendance for your own groups.', 'error')
      return
    }
    setDirty(false)
    const attended = Object.values(toSave).filter((m) => m !== 'absent').length
    toast.show(`Attendance saved for ${session.group.name}: ${attended} of ${students.length} attended.`)
  }

  return (
    <Panel
      title={session.group.name}
      description={`${session.start}–${session.end}, ${session.group.room}, ${session.teacher?.fullName ?? 'no teacher'}`}
      actions={
        students.length > 0 && !isFuture ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setMarks(Object.fromEntries(students.map((s) => [s.id, 'present'])))
              setDirty(true)
            }}
          >
            <Check aria-hidden />
            Mark all present
          </Button>
        ) : undefined
      }
      flush
    >
      {students.length === 0 ? (
        <EmptyState icon={Users} title="No students in this group yet">
          {user?.role === 'teacher'
            ? 'Your branch administrator adds students to groups.'
            : `Add students to ${session.group.name} from the Students page.`}
        </EmptyState>
      ) : isFuture ? (
        <EmptyState icon={CalendarOff} title="This class hasn’t started yet">
          Attendance can be taken once the class begins at {session.start}.
        </EmptyState>
      ) : (
        <>
          <div className={cn('mx-5 mb-3 rounded-control px-3 py-2 text-sm', record && !dirty ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')} role="status">
            {record && !dirty
              ? `Last saved ${formatRelative(record.savedAt, now).replace(/^(Today|Yesterday|Just now)/, (w) => w.toLowerCase())}. Change any mark and save again to update it.`
              : record
                ? 'You have unsaved changes.'
                : 'Not saved yet. Everyone starts as present; change anyone who is late or absent.'}
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {students.map((s) => {
              const inGroup = s.groupId === session.group.id
              const comment = comments[s.id] ?? ''
              const showNote = noteOpen[s.id] || comment !== ''
              return (
                <li key={s.id} className="flex flex-col gap-2 px-5 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={s.fullName} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{s.fullName}</p>
                      {!inGroup && <p className="text-xs text-ink-muted">No longer in this group</p>}
                    </div>
                  </div>
                  <fieldset className="flex shrink-0 gap-1.5">
                    <legend className="sr-only">Attendance for {s.fullName}</legend>
                    {MARKS.map((m) => (
                      <label key={m} className="relative">
                        <input
                          type="radio"
                          name={`mark-${s.id}`}
                          value={m}
                          checked={marks[s.id] === m}
                          onChange={() => setMark(s.id, m)}
                          className="peer sr-only"
                        />
                        <span
                          className={cn(
                            'flex h-8 min-w-[4.5rem] cursor-pointer items-center justify-center rounded-control border border-line-strong px-2.5 text-xs font-medium text-ink-muted select-none hover:bg-subtle',
                            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand',
                            markStyle[m],
                          )}
                        >
                          {attendanceMarkLabel[m]}
                        </span>
                      </label>
                    ))}
                    <IconButton
                      label={`Add a note for ${s.fullName}`}
                      onClick={() => setNoteOpen((o) => ({ ...o, [s.id]: true }))}
                      disabled={showNote}
                      className="size-8 disabled:opacity-40"
                    >
                      <MessageSquarePlus />
                    </IconButton>
                  </fieldset>
                  {showNote && (
                    <div className="w-full sm:pl-11">
                      <Input
                        aria-label={`Note for ${s.fullName}`}
                        value={comment}
                        maxLength={200}
                        autoFocus={noteOpen[s.id] && comment === ''}
                        placeholder="Optional note, e.g. “Arrived 15 minutes late”"
                        onChange={(e) => setComment(s.id, e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-panel border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
            <p className="num text-sm text-ink-muted">
              {counts.map(([m, n], i) => (
                <span key={m}>
                  {i > 0 && ', '}
                  <span className="font-medium text-ink">{n}</span> {attendanceMarkLabel[m].toLowerCase()}
                </span>
              ))}
            </p>
            <Button variant="primary" onClick={save} disabled={Boolean(record) && !dirty}>
              {record ? 'Update attendance' : 'Save attendance'}
            </Button>
          </div>
        </>
      )}
    </Panel>
  )
}

/** Earlier saved attendance for the group, newest first. */
function RecentRecords({ group, current, onOpen }: { group: Group; current: string; onOpen: (date: string) => void }) {
  const { data } = useSchool()
  const all = useMemo(
    () => data.attendance.filter((r) => r.groupId === group.id).sort((a, b) => b.date.localeCompare(a.date)),
    [data.attendance, group.id],
  )
  const overall = summarizeMarks(all)

  return (
    <Panel
      title="Recorded attendance"
      description={
        overall.rate === null
          ? `No attendance saved for ${group.name} yet.`
          : `${formatPercent(overall.rate)} attended across ${all.length} saved ${all.length === 1 ? 'class' : 'classes'}. Showing the latest ${Math.min(all.length, 8)}.`
      }
      flush
    >
      {all.length === 0 ? (
        <EmptyState icon={History} title="Nothing recorded yet">
          Saved classes appear here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {all.slice(0, 8).map((r) => {
            const summary = summarizeMarks([r])
            const notes = Object.keys(r.comments ?? {}).length
            const isCurrent = r.date === current
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpen(r.date)}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={cn(
                    'flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-left text-sm hover:bg-canvas',
                    isCurrent && 'bg-brand-soft hover:bg-brand-soft',
                  )}
                >
                  <span className="num w-36 shrink-0 font-medium whitespace-nowrap text-ink">
                    {formatDate(r.date)}, {r.startTime}
                  </span>
                  <span className="num min-w-0 flex-1 text-ink-muted">
                    {summary.present} present, {summary.late} late, {summary.absent} absent
                    {notes > 0 && `, ${notes} ${notes === 1 ? 'note' : 'notes'}`}
                  </span>
                  <span className="num text-xs font-medium text-ink">{summary.rate === null ? '' : formatPercent(summary.rate)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
