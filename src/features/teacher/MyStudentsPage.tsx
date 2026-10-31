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

const FILTERS = ['q', 'group', 'status'] as const

/**
 * Students in the teacher's own groups. Only what's needed for teaching is
 * shown: phone for contacting the family, no email, tuition or payments.
 */
export function MyStudentsPage() {
  const { data } = useSchool()
  const { values, set, clear, active } = useListParams(FILTERS)
  const groupName = useMemo(() => new Map(data.groups.map((g) => [g.id, g.name])), [data.groups])

  const rows = useMemo(() => {
    const q = values.q.trim().toLowerCase()
    return data.students
      .filter((s) => (!q || s.fullName.toLowerCase().includes(q)) && (!values.group || s.groupId === values.group) && (!values.status || s.status === values.status))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((s) => ({ student: s, rate: studentAttendance(data, s.id).rate }))
  }, [data, values])

  return (
    <>
      <PageHeader title="My students" description={`${data.students.filter((s) => s.status === 'active').length} active students across your groups.`} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput label="Search students" placeholder="Search by name" value={values.q} onChange={(v) => set('q', v)} />
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
            <table className="w-full min-w-[640px] text-sm">
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
                    Phone
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ student, rate }) => (
                  <tr key={student.id}>
                    <td className={td}>
                      <span className="flex items-center gap-3">
                        <Avatar name={student.fullName} size="sm" />
                        <span className="font-medium text-ink">{student.fullName}</span>
                      </span>
                    </td>
                    <td className={td}>
                      <Link to={`/teacher/groups/${student.groupId}`} className="text-ink hover:text-brand hover:underline">
                        {groupName.get(student.groupId ?? '') ?? '—'}
                      </Link>
                    </td>
                    <td className={cn(td, 'num text-right font-medium', rateTone(rate))}>{rate === null ? '—' : formatPercent(rate)}</td>
                    <td className={cn(td, 'num whitespace-nowrap text-ink-muted')}>
                      <a href={`tel:${student.phone.replace(/\s/g, '')}`} className="hover:text-ink hover:underline">
                        {student.phone}
                      </a>
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
