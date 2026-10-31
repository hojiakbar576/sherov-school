import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronLeft, ClipboardCheck, Lock, NotebookPen, Users } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { ButtonLink } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { Avatar, EmptyState, TableScroll, td, th } from '../../components/ui/misc'
import { GroupStatusBadge, StudentStatusBadge } from '../../components/StatusBadges'
import { endTime } from '../../lib/schedule'
import { dayPatternLabel, formatDate, formatPercent } from '../../lib/format'
import { studentAttendance, summarizeMarks } from '../../lib/metrics'
import { cn } from '../../lib/cn'
import { rateTone, splitHomework } from './teacher-metrics'

export function GroupDetailPage() {
  const { groupId } = useParams()
  const { data, now } = useSchool()
  // Scoped data only holds this teacher's groups, so anyone else's is simply not found.
  const group = data.groups.find((g) => g.id === groupId)

  const students = useMemo(
    () =>
      data.students
        .filter((s) => s.groupId === groupId)
        .sort((a, b) => (a.status === b.status ? a.fullName.localeCompare(b.fullName) : a.status === 'active' ? -1 : 1))
        .map((s) => ({ student: s, rate: studentAttendance(data, s.id).rate })),
    [data, groupId],
  )

  if (!group) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        <EmptyState icon={Lock} title="This group isn’t one of yours" action={<ButtonLink to="/teacher/groups">Back to my groups</ButtonLink>}>
          You can only open groups you teach. It may also have been deleted.
        </EmptyState>
      </div>
    )
  }

  const records = data.attendance.filter((r) => r.groupId === group.id)
  const overall = summarizeMarks(records)
  const branch = data.branches.find((b) => b.id === group.branchId)
  const { current, past } = splitHomework(data.homework.filter((h) => h.groupId === group.id), now)
  const active = students.filter((s) => s.student.status === 'active').length

  return (
    <div className="space-y-6">
      <div>
        <Link to="/teacher/groups" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft aria-hidden className="size-4" />
          My groups
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink">{group.name}</h1>
              <GroupStatusBadge status={group.status} />
            </div>
            <p className="num mt-1 text-ink-muted">
              {group.subject} · {dayPatternLabel[group.days]}, {group.startTime}–{endTime(group)} · {group.room}
              {branch && `, ${branch.name}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink to={`/teacher/homework?group=${group.id}`}>
              <NotebookPen aria-hidden />
              Homework
            </ButtonLink>
            <ButtonLink to={`/teacher/attendance?group=${group.id}`} variant="primary">
              <ClipboardCheck aria-hidden />
              Attendance
            </ButtonLink>
          </div>
        </div>
      </div>

      <dl className="num grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-4">
        {[
          ['Students', `${active} of ${group.capacity}`],
          ['Attendance', overall.rate === null ? '—' : formatPercent(overall.rate)],
          ['Classes recorded', String(records.length)],
          ['Homework due', String(current.length)],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface px-5 py-4">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <Panel title="Students" description="Attendance is across every saved class in this group." className="xl:col-span-8" flush>
          {students.length === 0 ? (
            <EmptyState icon={Users} title="No students yet">
              Your branch administrator adds students to groups.
            </EmptyState>
          ) : (
            <TableScroll>
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-y border-line bg-canvas">
                  <tr>
                    <th scope="col" className={th}>
                      Student
                    </th>
                    <th scope="col" className={th}>
                      Phone
                    </th>
                    <th scope="col" className={cn(th, 'text-right')}>
                      Attendance
                    </th>
                    <th scope="col" className={th}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {students.map(({ student, rate }) => (
                    <tr key={student.id}>
                      <td className={td}>
                        <span className="flex items-center gap-3">
                          <Avatar name={student.fullName} size="sm" />
                          <span className="font-medium text-ink">{student.fullName}</span>
                        </span>
                      </td>
                      <td className={cn(td, 'num whitespace-nowrap text-ink-muted')}>
                        <a href={`tel:${student.phone.replace(/\s/g, '')}`} className="hover:text-ink hover:underline">
                          {student.phone}
                        </a>
                      </td>
                      <td className={cn(td, 'num text-right font-medium', rateTone(rate))}>{rate === null ? '—' : formatPercent(rate)}</td>
                      <td className={td}>
                        <StudentStatusBadge status={student.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Panel>

        <Panel
          title="Homework"
          className="xl:col-span-4"
          actions={
            <Link to={`/teacher/homework?group=${group.id}`} className="text-sm font-medium text-brand hover:underline">
              Manage
            </Link>
          }
          flush
        >
          {current.length + past.length === 0 ? (
            <EmptyState icon={NotebookPen} title="No homework set" />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {[...current, ...past.slice(0, 4)].map((h) => (
                <li key={h.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-ink">{h.title}</p>
                  <p className="num text-xs text-ink-muted">
                    {past.includes(h) ? 'Was due' : 'Due'} {formatDate(h.dueDate)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
