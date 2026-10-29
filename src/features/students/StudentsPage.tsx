import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Eye, Pencil, Plus, Trash2, Users } from 'lucide-react'
import type { Student } from '../../types'
import { useSchool } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button, IconButton } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { Avatar, EmptyState, Pagination, SearchInput, TableScroll, td, th } from '../../components/ui/misc'
import { StudentStatusBadge, TuitionBadge } from '../../components/StatusBadges'
import { formatDate, formatNumber, studentStatusLabel } from '../../lib/format'
import { cn } from '../../lib/cn'
import { StudentFormDialog } from './StudentFormDialog'
import { DeleteStudentDialog } from './DeleteStudentDialog'

const PAGE_SIZE = 20
const FILTERS = ['q', 'group', 'status', 'tuition'] as const

export function StudentsPage() {
  const { data, balances } = useSchool()
  const { values, page, set, setPage, clear, active } = useListParams(FILTERS)
  const [editing, setEditing] = useState<Student | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Student | null>(null)

  const groupName = useMemo(() => new Map(data.groups.map((g) => [g.id, g.name])), [data.groups])

  const filtered = useMemo(() => {
    const q = values.q.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return data.students
      .filter((s) => {
        if (q && !s.fullName.toLowerCase().includes(q) && !(s.email ?? '').toLowerCase().includes(q) && !(digits.length >= 3 && s.phone.replace(/\D/g, '').includes(digits))) return false
        if (values.group === 'none' ? s.groupId !== null : values.group && s.groupId !== values.group) return false
        if (values.status && s.status !== values.status) return false
        const b = balances.get(s.id)
        if (values.tuition === 'owing' && !(b && b.owed > 0)) return false
        if (values.tuition === 'overdue' && b?.status !== 'overdue') return false
        if (values.tuition === 'paid' && b?.status !== 'paid') return false
        return true
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [data.students, balances, values])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const activeCount = data.students.filter((s) => s.status === 'active').length

  const actions = (s: Student) => (
    <div className="flex justify-end gap-0.5">
      <Link to={`/students/${s.id}`} aria-label={`View ${s.fullName}`} title="View" className="inline-flex size-9 items-center justify-center rounded-control text-ink-muted hover:bg-subtle hover:text-ink">
        <Eye className="size-[18px]" />
      </Link>
      <IconButton label={`Edit ${s.fullName}`} onClick={() => setEditing(s)}>
        <Pencil />
      </IconButton>
      <IconButton label={`Delete ${s.fullName}`} onClick={() => setDeleting(s)} className="hover:bg-danger-soft hover:text-danger">
        <Trash2 />
      </IconButton>
    </div>
  )

  return (
    <>
      <PageHeader
        title="Students"
        description={`${formatNumber(data.students.length)} students on record, ${formatNumber(activeCount)} currently active.`}
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            Add student
          </Button>
        }
      />

      <section aria-label="Student list" className="rounded-panel border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput label="Search students" value={values.q} onChange={(v) => set('q', v)} placeholder="Name, phone or email" />
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
            <Select aria-label="Filter by status" value={values.status} onChange={(e) => set('status', e.target.value)} className="sm:w-36">
              <option value="">All statuses</option>
              {Object.entries(studentStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
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
                <caption className="sr-only">Students</caption>
                <thead className="bg-canvas">
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>Student</th>
                    <th scope="col" className={th}>Group</th>
                    <th scope="col" className={cn(th, 'hidden lg:table-cell')}>Enrolled</th>
                    <th scope="col" className={th}>Tuition</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={th}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((s) => (
                    <tr key={s.id} className="hover:bg-canvas/60">
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <Avatar name={s.fullName} />
                          <div className="min-w-0">
                            <Link to={`/students/${s.id}`} className="font-medium text-ink hover:text-accent hover:underline">
                              {s.fullName}
                            </Link>
                            <p className="num truncate text-xs text-ink-muted">
                              {s.phone}
                              {s.email && <span className="hidden xl:inline">, {s.email}</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={cn(td, 'text-ink-muted')}>{s.groupId ? groupName.get(s.groupId) : <span className="text-ink-faint">No group</span>}</td>
                      <td className={cn(td, 'num hidden whitespace-nowrap text-ink-muted lg:table-cell')}>{formatDate(s.enrolledOn)}</td>
                      <td className={td}>
                        <TuitionBadge balance={balances.get(s.id)} />
                      </td>
                      <td className={td}>
                        <StudentStatusBadge status={s.status} />
                      </td>
                      <td className={cn(td, 'py-1.5')}>{actions(s)}</td>
                    </tr>
                  ))}
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
                    <p className="num text-xs text-ink-muted">{s.phone}</p>
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
      <DeleteStudentDialog student={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}
