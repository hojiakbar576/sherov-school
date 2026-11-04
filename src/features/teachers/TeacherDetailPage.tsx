import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, CalendarOff, Pencil, UserRoundX, UsersRound } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { Panel } from '../../components/ui/Panel'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Avatar, EmptyState, TableScroll, td, th } from '../../components/ui/misc'
import { PhoneLine } from '../../components/ui/CopyButton'
import { GroupStatusBadge, SessionStatusBadge, TeacherStatusBadge } from '../../components/StatusBadges'
import { addDays, monthKey, toISODate } from '../../lib/dates'
import { dayPatternLabel, formatDate, formatDayShort, formatMonth, formatPercent, formatUZS } from '../../lib/format'
import { enrolmentByGroup, sessionsOn, summarizeMarks } from '../../lib/metrics'
import { endTime } from '../../lib/schedule'
import { RATING_PART_LABEL, RATING_PARTS, teacherRatings } from '../../lib/rating'
import { teacherSalary } from '../../lib/salary'
import { cn } from '../../lib/cn'
import { TeacherFormDialog } from './TeacherFormDialog'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  )
}

/** One teacher for the administrator: contact, groups, this week's classes and how this month is going. */
export function TeacherDetailPage() {
  const { teacherId } = useParams()
  const { data, now } = useSchool()
  const [editing, setEditing] = useState(false)
  const teacher = data.teachers.find((t) => t.id === teacherId)
  const month = monthKey(now)
  const rating = useMemo(() => (teacher ? teacherRatings(data, month, now).find((r) => r.teacherId === teacher.id) : undefined), [data, month, now, teacher])
  const salary = useMemo(() => (teacher ? teacherSalary(data, teacher.id, month) : undefined), [data, month, teacher])

  if (!teacher || !salary) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        <EmptyState icon={UserRoundX} title="Teacher not found" action={<ButtonLink to="/teachers">Back to teachers</ButtonLink>}>
          They may have been deleted, or they work at another branch.
        </EmptyState>
      </div>
    )
  }

  const enrolment = enrolmentByGroup(data)
  const groups = data.groups.filter((g) => g.teacherId === teacher.id).sort((a, b) => Number(a.status !== 'active') - Number(b.status !== 'active') || a.name.localeCompare(b.name))
  const running = groups.filter((g) => g.status === 'active')
  const students = running.reduce((sum, g) => sum + (enrolment.get(g.id) ?? 0), 0)
  const branchName = new Map(data.branches.map((b) => [b.id, b.name]))
  const week = Array.from({ length: 7 }, (_, i) => toISODate(addDays(now, i))).flatMap((date) =>
    sessionsOn(data, date, now).filter((s) => s.group.teacherId === teacher.id),
  )
  const today = toISODate(now)

  return (
    <>
      <Link to="/teachers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        All teachers
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={teacher.fullName} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink">{teacher.fullName}</h1>
              <TeacherStatusBadge status={teacher.status} />
            </div>
            <p className="mt-0.5 text-ink-muted">
              {teacher.subject} · {branchName.get(teacher.branchId)} branch · {running.length} running {running.length === 1 ? 'group' : 'groups'}, {students} students
            </p>
          </div>
        </div>
        <Button onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-6 lg:col-span-4">
          <Panel title="Contact and work">
            <dl className="divide-y divide-line text-sm">
              <Row label="Phone">
                <PhoneLine phone={teacher.phone} />
              </Row>
              <Row label="Email">
                <a href={`mailto:${teacher.email}`} className="break-all hover:text-brand hover:underline">
                  {teacher.email}
                </a>
              </Row>
              <Row label="Teaches">{teacher.subject}</Row>
              <Row label="Joined">
                <span className="num">{formatDate(teacher.joinedOn)}</span>
              </Row>
              <Row label="Branch">{branchName.get(teacher.branchId)}</Row>
              {teacher.branchHistory && teacher.branchHistory.length > 1 && (
                <Row label="Earlier branches">
                  {teacher.branchHistory
                    .slice(0, -1)
                    .map((h) => `${branchName.get(h.branchId) ?? '—'} from ${formatDate(h.from)}`)
                    .join('; ')}
                </Row>
              )}
              <Row label="Pay share">
                <span className="num">{teacher.salaryPercent}% of paid tuition</span>
              </Row>
            </dl>
            <p className="mt-3 text-xs text-ink-muted">Only the owner can move a teacher to another branch. Their history stays with them.</p>
          </Panel>

          <Panel title={`Pay for ${formatMonth(month)}`} description="So far, from tuition paid for this month.">
            <p className="num text-2xl font-semibold text-ink">{formatUZS(salary.amount)}</p>
            <p className="num mt-1 text-sm text-ink-muted">
              {teacher.salaryPercent}% of {formatUZS(salary.collected)} collected from {salary.lines.length} {salary.lines.length === 1 ? 'payment' : 'payments'}
            </p>
            {salary.groups.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                {salary.groups.map((g) => (
                  <li key={g.groupId} className="flex justify-between gap-3">
                    <span className="truncate text-ink-muted">{g.groupName}</span>
                    <span className="num shrink-0 text-ink">{formatUZS(g.share)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-8">
          <Panel title="Groups" flush>
            {groups.length === 0 ? (
              <EmptyState icon={UsersRound} title="No groups yet" action={<ButtonLink to="/groups">Open groups</ButtonLink>}>
                Assign this teacher to a group on the Groups page.
              </EmptyState>
            ) : (
              <TableScroll>
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="border-y border-line bg-canvas">
                    <tr>
                      <th scope="col" className={th}>Group</th>
                      <th scope="col" className={th}>Schedule</th>
                      <th scope="col" className={cn(th, 'text-right')}>Students</th>
                      <th scope="col" className={cn(th, 'text-right')}>Attendance</th>
                      <th scope="col" className={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {groups.map((g) => {
                      const rate = summarizeMarks(data.attendance.filter((r) => r.groupId === g.id)).rate
                      return (
                        <tr key={g.id}>
                          <td className={td}>
                            <Link to={`/groups?q=${encodeURIComponent(g.name)}`} className="font-medium text-ink hover:text-brand hover:underline">
                              {g.name}
                            </Link>
                            <p className="text-xs text-ink-muted">{g.subject}</p>
                          </td>
                          <td className={cn(td, 'num text-ink-muted')}>
                            {dayPatternLabel[g.days]}, {g.startTime}–{endTime(g)}
                            <p className="text-xs">{g.room}</p>
                          </td>
                          <td className={cn(td, 'num text-right')}>
                            {enrolment.get(g.id) ?? 0}/{g.capacity}
                          </td>
                          <td className={cn(td, 'num text-right', rate !== null && rate < 0.75 ? 'text-warning' : 'text-ink')}>{rate === null ? '—' : formatPercent(rate)}</td>
                          <td className={td}>
                            <GroupStatusBadge status={g.status} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Panel>

          <Panel title="Next 7 days" flush>
            {week.length === 0 ? (
              <EmptyState icon={CalendarOff} title="No classes in the next 7 days" />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {week.map((s) => (
                  <li key={`${s.group.id}-${s.date}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                    <span className="num w-28 shrink-0 text-ink-muted">{s.date === today ? 'Today' : formatDayShort(new Date(`${s.date}T12:00`))}</span>
                    <span className="num w-24 shrink-0 font-medium text-ink">
                      {s.start}–{s.end}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {s.group.name} <span className="text-ink-muted">· {s.group.room}</span>
                    </span>
                    <SessionStatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`This month so far`} description="Measured from lessons, attendance and homework they recorded. Not a final ranking.">
            {!rating ? (
              <p className="text-sm text-ink-muted">Nothing to measure yet this month.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                {RATING_PARTS.map((part) => {
                  const value = rating.parts[part]
                  return (
                    <div key={part}>
                      <dt className="text-xs text-ink-muted" title={RATING_PART_LABEL[part].detail}>
                        {RATING_PART_LABEL[part].title}
                      </dt>
                      <dd className={cn('num text-lg font-semibold', value !== null && value < 0.7 ? 'text-warning' : 'text-ink')}>{value === null ? '—' : formatPercent(value)}</dd>
                    </div>
                  )
                })}
              </dl>
            )}
          </Panel>
        </div>
      </div>

      <TeacherFormDialog open={editing} teacher={teacher} onClose={() => setEditing(false)} />
    </>
  )
}
