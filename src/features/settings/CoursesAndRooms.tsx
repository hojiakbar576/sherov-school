import { useState, type FormEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { Course, Room } from '../../types'
import { useSchool } from '../../data/school-context'
import { useBranchChoice } from '../../hooks/useBranchChoice'
import { useToast } from '../../components/ui/toast-context'
import { Panel } from '../../components/ui/Panel'
import { Button, IconButton } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/cn'
import { formatUZS } from '../../lib/format'

/**
 * The courses the centre offers. Shared by every branch; turning a course
 * off hides it from new groups and enquiries but keeps it on old records.
 */
export function CoursesPanel() {
  const { data, actions } = useSchool()
  const toast = useToast()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Course | null>(null)
  const groupsPer = (course: string) => data.groups.filter((g) => g.subject === course && g.status === 'active').length

  const add = (event: FormEvent) => {
    event.preventDefault()
    const clean = name.trim().replace(/\s+/g, ' ')
    if (clean.length < 2) return setError('Enter the course name.')
    if (data.courses.some((c) => c.name.toLowerCase() === clean.toLowerCase())) return setError('That course is already on the list.')
    actions.addCourse(clean)
    toast.show(`${clean} added to courses.`)
    setName('')
  }

  return (
    <Panel id="courses" title="Courses" description="Shared by all branches. Used for groups, teachers and enquiries." flush>
      <ul className="divide-y divide-line border-t border-line">
        {data.courses.map((c) => {
          const n = groupsPer(c.name)
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className={cn('block', c.active ? 'text-ink' : 'text-ink-faint line-through')}>{c.name}</span>
                <span className="block text-xs text-ink-muted">
                  {c.levels?.length ? c.levels.join(' · ') : 'No levels set'}
                  {c.defaultFee ? ` · usually ${formatUZS(c.defaultFee)}/month` : ''}
                </span>
              </span>
              <span className="num text-xs text-ink-muted">{n ? `${n} running ${n === 1 ? 'group' : 'groups'}` : 'No groups yet'}</span>
              {!c.active && <Badge>Off</Badge>}
              <IconButton label={`Edit levels and price of ${c.name}`} onClick={() => setEditing(c)}>
                <Pencil />
              </IconButton>
              <Button size="sm" variant="ghost" onClick={() => actions.setCourseActive(c.id, !c.active)} aria-label={`${c.active ? 'Turn off' : 'Turn on'} ${c.name}`}>
                {c.active ? 'Turn off' : 'Turn on'}
              </Button>
            </li>
          )
        })}
      </ul>
      <form onSubmit={add} noValidate className="flex items-start gap-2 border-t border-line px-5 py-4">
        <Field label="New course" error={error || undefined} className="flex-1">
          {(p) => (
            <Input
              {...p}
              value={name}
              maxLength={60}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              placeholder="e.g. Russian"
            />
          )}
        </Field>
        <Button type="submit" className="mt-[1.6rem]">
          Add
        </Button>
      </form>
      <CourseDialog course={editing} onClose={() => setEditing(null)} />
    </Panel>
  )
}

/** The administrator's branch rooms, used when scheduling groups. */
export function RoomsPanel() {
  const { data, branch, actions } = useSchool()
  const toast = useToast()
  const needsBranch = useBranchChoice()
  const [editing, setEditing] = useState<Room | 'new' | null>(null)
  const rooms = [...data.rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const usedBy = (room: Room) => data.groups.filter((g) => g.room === room.name && g.branchId === room.branchId && g.status !== 'completed')

  return (
    <Panel
      id="rooms"
      title={branch ? `Rooms at ${branch.name}` : 'Rooms'}
      description="Groups are scheduled into these rooms; two running groups can’t share a room at the same time."
      actions={
        <Button size="sm" onClick={() => setEditing('new')} disabled={Boolean(needsBranch)} title={needsBranch ?? undefined}>
          Add room
        </Button>
      }
      flush
    >
      <ul className="divide-y divide-line border-t border-line">
        {rooms.map((r) => {
          const groups = usedBy(r)
          return (
            <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block text-ink">{r.name}</span>
                <span className="block truncate text-xs text-ink-muted">{groups.length ? groups.map((g) => g.name).join(', ') : 'Not used by any group'}</span>
              </span>
              <span className="num text-xs text-ink-muted">{r.capacity ? `${r.capacity} seats` : ''}</span>
              <IconButton label={`Edit ${r.name}`} onClick={() => setEditing(r)}>
                <Pencil />
              </IconButton>
              <IconButton
                label={groups.length ? `${r.name} is in use` : `Delete ${r.name}`}
                disabled={groups.length > 0}
                onClick={() => {
                  if (actions.deleteRoom(r.id)) toast.show(`${r.name} deleted.`)
                }}
                className="hover:bg-danger-soft hover:text-danger disabled:opacity-30"
              >
                <Trash2 />
              </IconButton>
            </li>
          )
        })}
      </ul>
      <RoomDialog room={editing} onClose={() => setEditing(null)} />
    </Panel>
  )
}

function RoomDialog({ room, onClose }: { room: Room | 'new' | null; onClose: () => void }) {
  return (
    <Dialog open={room !== null} onClose={onClose} title={room === 'new' ? 'Add room' : 'Edit room'} size="sm" description={room && room !== 'new' ? 'Renaming a room renames it on its groups too.' : undefined}>
      {room !== null && <RoomForm room={room === 'new' ? undefined : room} onClose={onClose} />}
    </Dialog>
  )
}

function RoomForm({ room, onClose }: { room?: Room; onClose: () => void }) {
  const { data, actions } = useSchool()
  const toast = useToast()
  const [name, setName] = useState(room?.name ?? '')
  const [capacity, setCapacity] = useState(room?.capacity ? String(room.capacity) : '')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const clean = name.trim()
    if (clean.length < 1) return setError('Enter the room name.')
    if (data.rooms.some((r) => r.id !== room?.id && r.name.toLowerCase() === clean.toLowerCase())) return setError('There is already a room with that name.')
    const cap = capacity ? Number(capacity) : undefined
    if (cap !== undefined && (!Number.isInteger(cap) || cap < 1 || cap > 200)) return setError('Seats must be a whole number.')
    if (room) actions.updateRoom(room.id, { name: clean, capacity: cap })
    else actions.addRoom({ name: clean, capacity: cap })
    toast.show(room ? 'Room saved.' : `${clean} added.`)
    onClose()
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Name" error={error || undefined}>
        {(p) => (
          <Input
            {...p}
            autoFocus
            value={name}
            maxLength={40}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            placeholder="e.g. Room 106"
          />
        )}
      </Field>
      <Field label="Seats" optional>
        {(p) => <Input {...p} type="number" inputMode="numeric" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          {room ? 'Save' : 'Add room'}
        </Button>
      </div>
    </form>
  )
}

/** A course's levels (one per line, in order) and its usual monthly fee. */
function CourseDialog({ course, onClose }: { course: Course | null; onClose: () => void }) {
  return (
    <Dialog open={course !== null} onClose={onClose} title={course ? `${course.name}: levels and price` : 'Course'} size="sm">
      {course && <CourseForm course={course} onClose={onClose} />}
    </Dialog>
  )
}

function CourseForm({ course, onClose }: { course: Course; onClose: () => void }) {
  const { actions } = useSchool()
  const toast = useToast()
  const [levels, setLevels] = useState((course.levels ?? []).join('\n'))
  const [fee, setFee] = useState(course.defaultFee ? String(course.defaultFee) : '')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const n = fee ? Number(fee) : undefined
    if (n !== undefined && (!Number.isFinite(n) || n <= 0)) return setError('Enter the monthly fee in UZS, or leave it empty.')
    const list = levels.split('\n').map((l) => l.trim()).filter(Boolean)
    actions.updateCourse(course.id, { levels: Array.from(new Set(list)), defaultFee: n })
    toast.show(`${course.name} saved.`)
    onClose()
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Levels" optional hint="One per line, from first to last. New groups choose one.">
        {(p) => <Textarea {...p} rows={6} value={levels} onChange={(e) => setLevels(e.target.value)} placeholder={'Beginner\nElementary\nPre-Intermediate'} />}
      </Field>
      <Field label="Usual monthly fee (UZS)" optional error={error || undefined} hint="Filled in when a new group of this course is created.">
        {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={10000} value={fee} onChange={(e) => setFee(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save
        </Button>
      </div>
    </form>
  )
}
