import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Download, Pencil, Plus, Users } from 'lucide-react'
import type { Student, StudentStatus } from '../../types'
import { ARCHIVED_STUDENT_STATUSES, CURRENT_STUDENT_STATUSES } from '../../types'
import { useSchool } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button, IconButton } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { Avatar, EmptyState, Pagination, SearchInput, TableScroll, td, th } from '../../components/ui/misc'
import { StudentStatusBadge, TuitionBadge } from '../../components/StatusBadges'
import { formatNumber, formatPercent, guardianRelationshipLabel, studentStatusLabel } from '../../lib/format'
import { PhoneLine } from '../../components/ui/CopyButton'
import { cn } from '../../lib/cn'
import { downloadCSV } from '../../lib/csv'
import { RangeToggle } from '../../components/ui/RangeToggle'
import { toISODate } from '../../lib/dates'
import { StudentFormDialog } from './StudentFormDialog'

const PAGE_SIZE = 20

/** Name, email, the student's phone, or a parent's name or phone. */
function matchesStudent(s: Student, q: string, digits: string): boolean {
  if (s.fullName.toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q)) return true
  if (s.guardians.some((g) => g.fullName.toLowerCase().includes(q))) return true
  if (digits.length < 3) return false
  return [s.phone, ...s.guardians.flatMap((g) => [g.phone, g.altPhone ?? ''])].some((p) => p.replace(/\D/g, '').includes(digits))
}
const FILTERS = ['q', 'group', 'status', 'tuition', 'view'] as const

export function StudentsPage() {
  const { data, balances, now } = useSchool()
  const { values, page, set, setPage, clear, active } = useListParams(FILTERS)
  const [editing, setEditing] = useState<Student | 'new' | null>(null)

  const groupName = useMemo(() => new Map(data.groups.map((g) => [g.id, g.name])), [data.groups])
  const teacherOf = useMemo(() => {
    const teacher = new Map(data.teachers.map((t) => [t.id, t.fullName]))
    return new Map(data.groups.map((g) => [g.id, teacher.get(g.teacherId)]))
  }, [data.groups, data.teachers])
  // Attendance rate per student across every saved class, worked out once.
  const attendanceRate = useMemo(() => {
    const counts = new Map<string, [number, number]>()
    for (const r of data.attendance) {
      for (const [id, mark] of Object.entries(r.marks)) {
        const c = counts.get(id) ?? [0, 0]
        c[1] += 1
        if (mark !== 'absent') c[0] += 1
        counts.set(id, c)
      }
    }
    return new Map([...counts].map(([id, [came, all]]) => [id, came / all]))
  }, [data.attendance])
  const navigate = useNavigate()

  // The daily list is current students; leavers and graduates live in the archive.
  const archive = values.view === 'archive'
  const statuses: readonly StudentStatus[] = archive ? ARCHIVED_STUDENT_STATUSES : CURRENT_STUDENT_STATUSES
  const filtered = useMemo(() => {
    const q = values.q.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return data.students
      .filter((s) => {
        if (!statuses.includes(s.status)) return false
        if (q && !matchesStudent(s, q, digits)) return false
        if (values.group === 'none' ? s.groupId !== null : values.group && s.groupId !== values.group) return false
        // A status from the other view (e.g. "left" while on Current) is ignored.
        if (values.status && statuses.includes(values.status as StudentStatus) && s.status !== values.status) return false
        const b = balances.get(s.id)
        if (values.tuition === 'owing' && !(b && b.owed > 0)) return false
        if (values.tuition === 'overdue' && b?.status !== 'overdue') return false
        if (values.tuition === 'paid' && b?.status !== 'paid') return false
        return true
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [data.students, balances, values, statuses])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const activeCount = data.students.filter((s) => s.status === 'active').length
  const pausedCount = data.students.filter((s) => s.status === 'paused').length
  const archivedCount = data.students.filter((s) => ARCHIVED_STUDENT_STATUSES.includes(s.status)).length

  const exportCSV = () =>
    downloadCSV(`sherov-school-students-${archive ? 'archive-' : ''}${toISODate(now)}.csv`, [
      ['Student', 'Student phone', 'Group', 'Teacher', 'Parent / guardian', 'Relationship', 'Parent phone', 'Second parent', 'Second parent phone', 'Attendance %', 'Monthly tuition (UZS)', 'Price note', 'Owed (UZS)', 'Tuition status', 'Status', 'Enrolled'],
      ...filtered.map((s) => {
        const [g1, g2] = s.guardians
        const rate = attendanceRate.get(s.id)
        const b = balances.get(s.id)
        return [
          s.fullName, s.phone, groupName.get(s.groupId ?? '') ?? '', teacherOf.get(s.groupId ?? '') ?? '',
          g1?.fullName, g1 ? guardianRelationshipLabel[g1.relationship] : '', g1?.phone, g2?.fullName, g2?.phone,
          rate === undefined ? '' : Math.round(rate * 100), s.monthlyTuition, s.tuitionAdjustment?.reason ?? '', b?.owed ?? 0, b?.status ?? '',
          studentStatusLabel[s.status], s.enrolledOn,
        ]
      }),
    ])

  const actions = (s: Student) => (
    <div className="flex justify-end gap-0.5">
      <IconButton label={`Edit ${s.fullName}`} onClick={() => setEditing(s)}>
        <Pencil />
      </IconButton>
    </div>
  )

  return (
    <>
      <PageHeader
        title="Students"
        description={`${formatNumber(activeCount)} active and ${formatNumber(pausedCount)} paused. ${formatNumber(archivedCount)} who left or graduated are in the archive.`}
        actions={
          <>
          <Button onClick={exportCSV} disabled={filtered.length === 0}>
            <Download aria-hidden />
            Export CSV
          </Button>
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            Add student
          </Button>
          </>
        }
      />

      <div className="mb-4">
        <RangeToggle
          label="Which students"
          value={archive ? 'archive' : 'current'}
          onChange={(v) => set('view', v === 'archive' ? 'archive' : '')}
          options={[
            { value: 'current', label: `Current (${activeCount + pausedCount})` },
            { value: 'archive', label: `Archive (${archivedCount})` },
          ]}
        />
      </div>

      <section aria-label="Student list" className="rounded-panel border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput label="Search students" value={values.q} onChange={(v) => set('q', v)} placeholder="Name, student or parent phone" />
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <Select aria-label="Filter by group" value={values.group} onChange={(e) => set('group', e.target.value)} className="sm:w-52">
              <option value="">All groups</option>
              <option value="none">No group</option>
              {data.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Filter by status" value={statuses.includes(values.status as StudentStatus) ? values.status : ''} onChange={(e) => set('status', e.target.value)} className="sm:w-36">
              <option value="">{archive ? 'Left and graduated' : 'Active and paused'}</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {studentStatusLabel[value]}
                </option>
              ))}
            </Select>
            <Select aria-label="Filter by tuition" value={values.tuition} onChange={(e) => set('tuition', e.target.value)} className="col-span-2 sm:w-44">
              <option value="">Any tuition status</option>
              <option value="owing">Owes tuition</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Fully paid</option>
            </Select>
          </div>
          {active && (
            <Button variant="ghost" size="sm" onClick={clear} className="self-start sm:self-auto">
              Clear filters
            </Button>
          )}
          <p className="num text-sm text-ink-muted sm:ml-auto" aria-live="polite">
            {formatNumber(filtered.length)} {filtered.length === 1 ? 'student' : 'students'}
          </p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={data.students.length ? 'No students match these filters' : 'No students yet'}
            action={active ? <Button onClick={clear}>Clear filters</Button> : <Button variant="primary" onClick={() => setEditing('new')}>Add student</Button>}
          >
            {active ? 'Try a different name, or clear the filters to see everyone.' : 'Add the first student to start tracking attendance and tuition.'}
          </EmptyState>
        ) : (
          <>
            {/* Wide screens: table */}
            <TableScroll>
              <table className="hidden w-full text-sm md:table">
                <caption className="sr-only">Students. Click a row to open the student profile.</caption>
                <thead className="bg-canvas">
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>Student</th>
                    <th scope="col" className={th}>Group</th>
                    <th scope="col" className={cn(th, 'hidden xl:table-cell')}>Parent / guardian</th>
                    <th scope="col" className={th}>Parent phone</th>
                    <th scope="col" className={cn(th, 'hidden lg:table-cell text-right')}>Attendance</th>
                    <th scope="col" className={th}>Tuition</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={th}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((s) => {
                    const parent = s.guardians[0]
                    const rate = attendanceRate.get(s.id)
                    return (
                      <tr key={s.id} onClick={() => navigate(`/students/${s.id}`)} className="cursor-pointer hover:bg-canvas/70">
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            <Avatar name={s.fullName} />
                            <div className="min-w-0">
                              <Link to={`/students/${s.id}`} onClick={(e) => e.stopPropagation()} className="font-medium whitespace-nowrap text-ink hover:text-brand hover:underline">
                                {s.fullName}
                              </Link>
                              <p className="num truncate text-xs text-ink-muted">{s.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className={td}>
                          {s.groupId ? (
                            <>
                              <p className="max-w-48 truncate text-ink" title={groupName.get(s.groupId)}>{groupName.get(s.groupId)}</p>
                              <p className="truncate text-xs text-ink-muted">{teacherOf.get(s.groupId) ?? 'No teacher'}</p>
                            </>
                          ) : (
                            <span className="text-ink-faint">No group</span>
                          )}
                        </td>
                        <td className={cn(td, 'hidden xl:table-cell')}>
                          {parent ? (
                            <>
                              <p className="whitespace-nowrap text-ink">{parent.fullName}</p>
                              <p className="text-xs text-ink-muted">{guardianRelationshipLabel[parent.relationship]}</p>
                            </>
                          ) : (
                            <span className="text-ink-faint">Not added</span>
                          )}
                        </td>
                        <td className={cn(td, 'py-2 text-ink')} onClick={(e) => e.stopPropagation()}>
                          {parent ? <PhoneLine phone={parent.phone} /> : <span className="text-ink-faint">—</span>}
                        </td>
                        <td className={cn(td, 'num hidden text-right lg:table-cell', rate !== undefined && rate < 0.75 ? 'font-medium text-warning' : 'text-ink')}>
                          {rate === undefined ? <span className="text-ink-faint">—</span> : formatPercent(rate)}
                        </td>
                        <td className={td}>
                          <TuitionBadge balance={balances.get(s.id)} />
                        </td>
                        <td className={td}>
                          <StudentStatusBadge status={s.status} />
                        </td>
                        <td className={cn(td, 'py-1.5')} onClick={(e) => e.stopPropagation()}>
                          {actions(s)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableScroll>

            {/* Small screens: stacked list */}
            <ul className="divide-y divide-line md:hidden">
              {visible.map((s) => (
                <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                  <Avatar name={s.fullName} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/students/${s.id}`} className="font-medium text-ink hover:underline">
                      {s.fullName}
                    </Link>
                    <p className="truncate text-xs text-ink-muted">{s.groupId ? groupName.get(s.groupId) : 'No group'}</p>
                    {s.guardians[0] ? (
                      <p className="text-xs text-ink-muted">
                        {guardianRelationshipLabel[s.guardians[0].relationship]}: <PhoneLine phone={s.guardians[0].phone} />
                      </p>
                    ) : (
                      <p className="num text-xs text-ink-muted">{s.phone}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <TuitionBadge balance={balances.get(s.id)} />
                      {s.status !== 'active' && <StudentStatusBadge status={s.status} />}
                    </div>
                  </div>
                  {actions(s)}
                </li>
              ))}
            </ul>
            <Pagination page={current} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} noun="students" />
          </>
        )}
      </section>

      <StudentFormDialog open={editing !== null} student={editing === 'new' || editing === null ? undefined : editing} onClose={() => setEditing(null)} />
    </>
  )
}
