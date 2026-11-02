import { useMemo } from 'react'
import { Link } from 'react-router'
import { Users } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { Avatar, EmptyState, SearchInput, TableScroll, td, th } from '../../components/ui/misc'
import { StudentStatusBadge } from '../../components/StatusBadges'
import { formatPercent } from '../../lib/format'
import { studentAttendance } from '../../lib/metrics'
import { cn } from '../../lib/cn'
import { rateTone } from './teacher-metrics'
import { GuardianContacts } from './LearningBadges'

const FILTERS = ['q', 'group', 'status'] as const

/**
 * Students in the teacher's own groups, with the parent or guardian to call.
 * No tuition or payments: those stay with the administrator.
 */
export function MyStudentsPage() {
  const { data } = useSchool()
  const { values, set, clear, active } = useListParams(FILTERS)
  const groupName = useMemo(() => new Map(data.groups.map((g) => [g.id, g.name])), [data.groups])

  const rows = useMemo(() => {
    const q = values.q.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return data.students
      .filter((s) => {
        if (values.group && s.groupId !== values.group) return false
        if (values.status && s.status !== values.status) return false
        if (!q) return true
        // Search by student or parent name, or a parent's phone number.
        if (s.fullName.toLowerCase().includes(q)) return true
        return s.guardians.some((g) => g.fullName.toLowerCase().includes(q) || (digits.length >= 3 && g.phone.replace(/\D/g, '').includes(digits)))
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((s) => ({ student: s, rate: studentAttendance(data, s.id).rate }))
  }, [data, values])

  return (
    <>
      <PageHeader
        title="My students"
        description={`${data.students.filter((s) => s.status === 'active').length} active students across your groups. Open a student to see their profile, attendance and homework.`}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput label="Search students or parents" placeholder="Student, parent or phone" value={values.q} onChange={(v) => set('q', v)} />
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select aria-label="Filter by group" value={values.group} onChange={(e) => set('group', e.target.value)} className="sm:w-56">
            <option value="">All my groups</option>
            {data.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by status" value={values.status} onChange={(e) => set('status', e.target.value)} className="sm:w-36">
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </Select>
        </div>
        {active && (
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="rounded-panel border border-line bg-surface">
        {rows.length === 0 ? (
          <EmptyState icon={Users} title={active ? 'No students match' : 'No students yet'}>
            {active ? 'Try a different name or group.' : 'Students appear here once they join one of your groups.'}
          </EmptyState>
        ) : (
          <TableScroll>
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">Students in your groups</caption>
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th scope="col" className={th}>
                    Student
                  </th>
                  <th scope="col" className={th}>
                    Group
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    Attendance
                  </th>
                  <th scope="col" className={th}>
                    Parent / guardian
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ student, rate }) => (
                  <tr key={student.id} className="hover:bg-canvas">
                    <td className={td}>
                      <Link to={`/teacher/students/${student.id}`} className="flex items-center gap-3 font-medium text-ink hover:text-brand-ink hover:underline">
                        <Avatar name={student.fullName} size="sm" />
                        {student.fullName}
                      </Link>
                    </td>
                    <td className={td}>
                      <Link to={`/teacher/groups/${student.groupId}`} className="text-ink-muted hover:text-ink hover:underline">
                        {groupName.get(student.groupId ?? '') ?? '—'}
                      </Link>
                    </td>
                    <td className={cn(td, 'num text-right font-medium', rateTone(rate))}>{rate === null ? '—' : formatPercent(rate)}</td>
                    <td className={cn(td, 'py-2.5')}>
                      <GuardianContacts guardians={student.guardians} ownPhone={student.phone} compact />
                    </td>
                    <td className={td}>
                      <StudentStatusBadge status={student.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </div>
    </>
  )
}
