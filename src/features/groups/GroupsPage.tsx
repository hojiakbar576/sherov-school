import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import type { Group } from '../../types'
import { SUBJECTS } from '../../types'
import { useSchool } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button, IconButton } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { EmptyState, SearchInput, TableScroll, td, th } from '../../components/ui/misc'
import { GroupStatusBadge } from '../../components/StatusBadges'
import { dayPatternLabel, formatUZS, groupStatusLabel } from '../../lib/format'
import { enrolmentByGroup } from '../../lib/metrics'
import { endTime } from '../../lib/schedule'
import { cn } from '../../lib/cn'
import { GroupFormDialog } from './GroupFormDialog'

const FILTERS = ['q', 'subject', 'status'] as const

function Seats({ count, capacity }: { count: number; capacity: number }) {
  const ratio = Math.min(1, count / capacity)
  const full = count >= capacity
  return (
    <div className="min-w-24">
      <p className="num text-sm">
        <span className={cn('font-medium', full ? 'text-danger' : 'text-ink')}>{count}</span>
        <span className="text-ink-muted"> / {capacity}</span>
        {full && <span className="ml-1.5 text-xs font-medium text-danger">Full</span>}
      </p>
      <div aria-hidden className="mt-1 h-1 w-full rounded-full bg-subtle">
        <div className={cn('h-1 rounded-full', full ? 'bg-danger-mark' : ratio >= 0.9 ? 'bg-warning-mark' : 'bg-accent')} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}

export function GroupsPage() {
  const { data, actions } = useSchool()
  const toast = useToast()
  const { values, set, clear, active } = useListParams(FILTERS)
  const [editing, setEditing] = useState<Group | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Group | null>(null)

  const enrolment = useMemo(() => enrolmentByGroup(data), [data])
  const teacherName = useMemo(() => new Map(data.teachers.map((t) => [t.id, t.fullName])), [data.teachers])

  const filtered = data.groups
    .filter((g) => {
      const q = values.q.trim().toLowerCase()
      if (q && !g.name.toLowerCase().includes(q) && !g.room.toLowerCase().includes(q) && !(teacherName.get(g.teacherId) ?? '').toLowerCase().includes(q)) return false
      if (values.subject && g.subject !== values.subject) return false
      if (values.status && g.status !== values.status) return false
      return true
    })
    .sort((a, b) => Number(a.status !== 'active') - Number(b.status !== 'active') || a.subject.localeCompare(b.subject) || a.name.localeCompare(b.name))

  const running = data.groups.filter((g) => g.status === 'active')
  const seats = running.reduce((sum, g) => sum + g.capacity, 0)
  const filled = running.reduce((sum, g) => sum + (enrolment.get(g.id) ?? 0), 0)

  const deletingStudents = deleting ? (enrolment.get(deleting.id) ?? 0) : 0
  const deletingRecords = deleting ? data.attendance.filter((r) => r.groupId === deleting.id).length : 0

  return (
    <>
      <PageHeader
        title="Groups"
        description={`${running.length} running groups using ${filled} of ${seats} seats.`}
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            Create group
          </Button>
        }
      />

      <section aria-label="Group list" className="rounded-panel border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput label="Search groups" value={values.q} onChange={(v) => set('q', v)} placeholder="Group, teacher or room" />
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Select aria-label="Filter by subject" value={values.subject} onChange={(e) => set('subject', e.target.value)} className="sm:w-48">
              <option value="">All subjects</option>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Select aria-label="Filter by status" value={values.status} onChange={(e) => set('status', e.target.value)} className="sm:w-36">
              <option value="">All statuses</option>
              {Object.entries(groupStatusLabel).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          {active && (
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear filters
            </Button>
          )}
          <p className="num text-sm text-ink-muted sm:ml-auto" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? 'group' : 'groups'}
          </p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={UsersRound} title="No groups match" action={<Button onClick={clear}>Clear filters</Button>}>
            Try a different name, teacher or room.
          </EmptyState>
        ) : (
          <>
            <TableScroll>
              <table className="hidden w-full text-sm lg:table">
                <caption className="sr-only">Groups</caption>
                <thead className="bg-canvas">
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>Group</th>
                    <th scope="col" className={th}>Teacher</th>
                    <th scope="col" className={th}>Schedule</th>
                    <th scope="col" className={th}>Room</th>
                    <th scope="col" className={th}>Students</th>
                    <th scope="col" className={cn(th, 'text-right')}>Monthly fee</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={th}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((g) => (
                    <tr key={g.id} className={cn(g.status !== 'active' && 'text-ink-muted')}>
                      <td className={td}>
                        <Link to={`/students?group=${g.id}`} className="font-medium text-ink hover:text-accent hover:underline">
                          {g.name}
                        </Link>
                        <p className="text-xs text-ink-muted">{g.subject}</p>
                      </td>
                      <td className={cn(td, 'text-ink-muted')}>{teacherName.get(g.teacherId) ?? 'Unassigned'}</td>
                      <td className={cn(td, 'whitespace-nowrap')}>
                        <p className="num">
                          {g.startTime}–{endTime(g)}
                        </p>
                        <p className="text-xs text-ink-muted">{dayPatternLabel[g.days]}</p>
                      </td>
                      <td className={cn(td, 'whitespace-nowrap text-ink-muted')}>{g.room}</td>
                      <td className={td}>
                        <Seats count={enrolment.get(g.id) ?? 0} capacity={g.capacity} />
                      </td>
                      <td className={cn(td, 'num text-right whitespace-nowrap')}>{formatUZS(g.monthlyFee)}</td>
                      <td className={td}>
                        <GroupStatusBadge status={g.status} />
                      </td>
                      <td className={cn(td, 'py-1.5')}>
                        <div className="flex justify-end gap-0.5">
                          <IconButton label={`Edit ${g.name}`} onClick={() => setEditing(g)}>
                            <Pencil />
                          </IconButton>
                          <IconButton label={`Delete ${g.name}`} onClick={() => setDeleting(g)} className="hover:bg-danger-soft hover:text-danger">
                            <Trash2 />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>

            <ul className="divide-y divide-line lg:hidden">
              {filtered.map((g) => (
                <li key={g.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/students?group=${g.id}`} className="font-medium text-ink hover:underline">
                        {g.name}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {g.subject}, {teacherName.get(g.teacherId) ?? 'Unassigned'}
                      </p>
                    </div>
                    <GroupStatusBadge status={g.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="num">
                        {g.startTime}–{endTime(g)}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {dayPatternLabel[g.days]}, {g.room}
                      </p>
                    </div>
                    <Seats count={enrolment.get(g.id) ?? 0} capacity={g.capacity} />
                    <p className="num text-ink-muted">{formatUZS(g.monthlyFee)}/mo</p>
                  </div>
                  <div className="mt-2 flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(g)}>
                      <Pencil aria-hidden />
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(g)} className="hover:bg-danger-soft hover:text-danger">
                      <Trash2 aria-hidden />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <GroupFormDialog open={editing !== null} group={editing === 'new' || editing === null ? undefined : editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete group?"
        confirmLabel="Delete group"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          actions.deleteGroup(deleting.id)
          toast.show(`${deleting.name} was deleted.`)
        }}
      >
        <p>
          <strong className="font-medium text-ink">{deleting?.name}</strong> will be removed. {deletingStudents} {deletingStudents === 1 ? 'student' : 'students'} will
          be left without a group, and {deletingRecords} attendance {deletingRecords === 1 ? 'record' : 'records'} for this group will be deleted.
        </p>
        <p>To keep its history, set its status to “Completed” instead.</p>
      </ConfirmDialog>
    </>
  )
}
