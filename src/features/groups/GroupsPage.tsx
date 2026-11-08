import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import type { Group } from '../../types'
import { useSchool } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button, IconButton } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { EmptyState, SearchInput, TableScroll, td, th } from '../../components/ui/misc'
import { GroupStatusBadge } from '../../components/StatusBadges'
import { formatUZS, groupStatusLabel, groupDaysLabel } from '../../lib/format'
import { enrolmentByGroup } from '../../lib/metrics'
import { endTime } from '../../lib/schedule'
import { cn } from '../../lib/cn'
import { GroupFormDialog } from './GroupFormDialog'
import { tr } from '../../i18n'

const FILTERS = ['q', 'course', 'level', 'status'] as const

function Seats({ count, capacity }: { count: number; capacity: number }) {
  const ratio = Math.min(1, count / capacity)
  const full = count >= capacity
  return (
    <div className="min-w-24">
      <p className="num text-sm">
        <span className={cn('font-medium', full ? 'text-danger' : 'text-ink')}>{count}</span>
        <span className="text-ink-muted"> / {capacity}</span>
        {full && <span className="ml-1.5 text-xs font-medium text-danger">{tr("Full")}</span>}
      </p>
      <div aria-hidden className="mt-1 h-1 w-full rounded-full bg-subtle">
        <div className={cn('h-1 rounded-full', full ? 'bg-danger-mark' : ratio >= 0.9 ? 'bg-warning-mark' : 'bg-brand')} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}

export function GroupsPage() {
  const { data, actions } = useSchool()
  const toast = useToast()
  const { values, set, setMany, clear, active } = useListParams(FILTERS)
  const [editing, setEditing] = useState<Group | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Group | null>(null)

  const enrolment = useMemo(() => enrolmentByGroup(data), [data])
  const teacherName = useMemo(() => new Map(data.teachers.map((t) => [t.id, t.fullName])), [data.teachers])

  // Course → Level → Group: filter and sort by the structure, in each course's own level order.
  const courseOrder = new Map(data.courses.map((c, i) => [c.id, i]))
  const levelOrder = new Map(data.courses.flatMap((c) => c.levels.map((l, i) => [l.id, i] as const)))
  const filterCourse = data.courses.find((c) => c.id === values.course)
  const filtered = data.groups
    .filter((g) => {
      const q = values.q.trim().toLowerCase()
      if (q && !g.name.toLowerCase().includes(q) && !g.room.toLowerCase().includes(q) && !(teacherName.get(g.teacherId) ?? '').toLowerCase().includes(q)) return false
      if (values.course && g.courseId !== values.course) return false
      if (values.level && g.levelId !== values.level) return false
      if (values.status && g.status !== values.status) return false
      return true
    })
    .sort(
      (a, b) =>
        Number(a.status !== 'active') - Number(b.status !== 'active') ||
        (courseOrder.get(a.courseId) ?? 0) - (courseOrder.get(b.courseId) ?? 0) ||
        (levelOrder.get(a.levelId) ?? 0) - (levelOrder.get(b.levelId) ?? 0) ||
        a.name.localeCompare(b.name, undefined, { numeric: true }),
    )

  const running = data.groups.filter((g) => g.status === 'active')
  const seats = running.reduce((sum, g) => sum + g.capacity, 0)
  const filled = running.reduce((sum, g) => sum + (enrolment.get(g.id) ?? 0), 0)

  const deletingStudents = deleting ? (enrolment.get(deleting.id) ?? 0) : 0
  const deletingRecords = deleting ? data.attendance.filter((r) => r.groupId === deleting.id).length : 0

  return (
    <>
      <PageHeader
        title={tr("Groups")}
        description={tr("{0} running groups using {1} of {2} seats.", running.length, filled, seats)}
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            {tr("Create group")}
          </Button>
        }
      />

      <section aria-label={tr("Group list")} className="rounded-panel border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput label={tr("Search groups")} value={values.q} onChange={(v) => set('q', v)} placeholder={tr("Group, teacher or room")} />
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Select
              aria-label={tr("Filter by course")}
              value={values.course}
              onChange={(e) => setMany({ course: e.target.value, level: '' })}
              className="sm:w-48"
            >
              <option value="">{tr("All courses")}</option>
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select aria-label={tr("Filter by level")} value={values.level} onChange={(e) => set('level', e.target.value)} disabled={!filterCourse} title={filterCourse ? undefined : tr("Choose a course first")} className="sm:w-44">
              <option value="">{tr("All levels")}</option>
              {filterCourse?.levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Select aria-label={tr("Filter by status")} value={values.status} onChange={(e) => set('status', e.target.value)} className="sm:w-36">
              <option value="">{tr("All statuses")}</option>
              {Object.entries(groupStatusLabel).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          {active && (
            <Button variant="ghost" size="sm" onClick={clear}>
              {tr("Clear filters")}
            </Button>
          )}
          <p className="num text-sm text-ink-muted sm:ml-auto" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? tr("group") : tr("groups")}
          </p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={UsersRound} title={tr("No groups match")} action={<Button onClick={clear}>{tr("Clear filters")}</Button>}>
            {tr("Try a different name, teacher or room.")}
          </EmptyState>
        ) : (
          <>
            <TableScroll>
              <table className="hidden w-full text-sm lg:table">
                <caption className="sr-only">{tr("Groups")}</caption>
                <thead className="bg-canvas">
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>{tr("Group")}</th>
                    <th scope="col" className={th}>{tr("Teacher")}</th>
                    <th scope="col" className={th}>{tr("Schedule")}</th>
                    <th scope="col" className={th}>{tr("Room")}</th>
                    <th scope="col" className={th}>{tr("Students")}</th>
                    <th scope="col" className={cn(th, 'text-right')}>{tr("Monthly fee")}</th>
                    <th scope="col" className={th}>{tr("Status")}</th>
                    <th scope="col" className={th}><span className="sr-only">{tr("Actions")}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((g) => (
                    <tr key={g.id} className={cn(g.status !== 'active' && 'text-ink-muted')}>
                      <td className={td}>
                        <Link to={`/groups/${g.id}`} className="font-medium text-ink hover:text-brand hover:underline">
                          {g.name}
                        </Link>
                        <p className="text-xs text-ink-muted">{g.subject}{g.level ? ` → ${g.level}` : ''}</p>
                      </td>
                      <td className={cn(td, 'text-ink-muted')}>{teacherName.get(g.teacherId) ?? tr("Unassigned")}</td>
                      <td className={cn(td, 'whitespace-nowrap')}>
                        <p className="num">
                          {g.startTime}–{endTime(g)}
                        </p>
                        <p className="text-xs text-ink-muted">{groupDaysLabel(g)}</p>
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
                          <IconButton label={tr("Edit {0}", g.name)} onClick={() => setEditing(g)}>
                            <Pencil />
                          </IconButton>
                          <IconButton label={tr("Delete {0}", g.name)} onClick={() => setDeleting(g)} className="hover:bg-danger-soft hover:text-danger">
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
                      <Link to={`/groups/${g.id}`} className="font-medium text-ink hover:underline">
                        {g.name}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {g.subject}{g.level ? ` → ${g.level}` : ''}, {teacherName.get(g.teacherId) ?? tr("Unassigned")}
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
                        {groupDaysLabel(g)}, {g.room}
                      </p>
                    </div>
                    <Seats count={enrolment.get(g.id) ?? 0} capacity={g.capacity} />
                    <p className="num text-ink-muted">{formatUZS(g.monthlyFee)}/mo</p>
                  </div>
                  <div className="mt-2 flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(g)}>
                      <Pencil aria-hidden />
                      {tr("Edit")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(g)} className="hover:bg-danger-soft hover:text-danger">
                      <Trash2 aria-hidden />
                      {tr("Delete")}
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
        title={tr("Delete group?")}
        confirmLabel={tr("Delete group")}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          actions.deleteGroup(deleting.id)
          toast.show(tr("{0} was deleted.", deleting.name))
        }}
      >
        <p>
          <strong className="font-medium text-ink">{deleting?.name}</strong>{' '}{tr("will be removed.")}{' '}{deletingStudents} {deletingStudents === 1 ? tr("student") : tr("students")}{' '}{tr("will be left without a group, and")}{' '}{deletingRecords}{' '}{tr("attendance")}{' '}{deletingRecords === 1 ? tr("record") : tr("records")}{' '}{tr("for this group will be deleted.")}
        </p>
        <p>{tr("To keep its history, set its status to “Completed” instead.")}</p>
      </ConfirmDialog>
    </>
  )
}
