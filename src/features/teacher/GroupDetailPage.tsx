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
import { GuardianContacts } from './LearningBadges'
import { homeworkProgress } from '../../lib/performance'
import { tr } from '../../i18n'

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
        <EmptyState icon={Lock} title={tr("This group isn’t one of yours")} action={<ButtonLink to="/teacher/groups">{tr("Back to my groups")}</ButtonLink>}>
          {tr("You can only open groups you teach. It may also have been deleted.")}
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
          {tr("My groups")}
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
              {tr("Homework")}
            </ButtonLink>
            <ButtonLink to={`/teacher/attendance?group=${group.id}`} variant="primary">
              <ClipboardCheck aria-hidden />
              {tr("Attendance")}
            </ButtonLink>
          </div>
        </div>
      </div>

      <dl className="num grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-4">
        {[
          [tr("Students"), tr("{0} of {1}", active, group.capacity)],
          [tr("Attendance"), overall.rate === null ? '—' : formatPercent(overall.rate)],
          [tr("Classes recorded"), String(records.length)],
          [tr("Homework due"), String(current.length)],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface px-5 py-4">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <Panel title={tr("Students")} description={tr("Attendance is across every saved class in this group.")} className="xl:col-span-8" flush>
          {students.length === 0 ? (
            <EmptyState icon={Users} title={tr("No students yet")}>
              {tr("Your branch administrator adds students to groups.")}
            </EmptyState>
          ) : (
            <TableScroll>
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-y border-line bg-canvas">
                  <tr>
                    <th scope="col" className={th}>
                      {tr("Student")}
                    </th>
                    <th scope="col" className={th}>
                      {tr("Main contact")}
                    </th>
                    <th scope="col" className={cn(th, 'text-right')}>
                      {tr("Attendance")}
                    </th>
                    <th scope="col" className={th}>
                      {tr("Status")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {students.map(({ student, rate }) => (
                    <tr key={student.id}>
                      <td className={td}>
                        <Link to={`/teacher/students/${student.id}`} className="flex items-center gap-3 font-medium text-ink hover:text-brand-ink hover:underline">
                          <Avatar name={student.fullName} size="sm" />
                          {student.fullName}
                        </Link>
                      </td>
                      <td className={cn(td, 'py-2.5')}>
                        <GuardianContacts guardians={student.guardians.slice(0, 1)} ownPhone={student.phone} compact />
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
          title={tr("Homework")}
          className="xl:col-span-4"
          actions={
            <Link to={`/teacher/homework?group=${group.id}`} className="text-sm font-medium text-brand hover:underline">
              {tr("Manage")}
            </Link>
          }
          flush
        >
          {current.length + past.length === 0 ? (
            <EmptyState icon={NotebookPen} title={tr("No homework set")} />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {[...current, ...past.slice(0, 4)].map((h) => (
                <li key={h.id}>
                  <Link to={`/teacher/homework/${h.id}`} className="block px-5 py-3 hover:bg-canvas">
                    <p className="text-sm font-medium text-ink">{h.title}</p>
                    <p className="num text-xs text-ink-muted">
                      {past.includes(h) ? tr("Was due") : tr("Due")} {formatDate(h.dueDate)} · {homeworkProgress(data, h).evaluated}{' '}{tr("evaluated")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
