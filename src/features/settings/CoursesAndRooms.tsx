import { useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Course, CourseLevel, Room } from '../../types'
import { levelId } from '../../lib/courses'
import { useSchool } from '../../data/school-context'
import { useBranchChoice } from '../../hooks/useBranchChoice'
import { useToast } from '../../components/ui/toast-context'
import { Panel } from '../../components/ui/Panel'
import { Button, IconButton } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/cn'
import { formatUZS } from '../../lib/format'
import { plural, tr } from '../../i18n'

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
  const groupsPer = (courseId: string) => data.groups.filter((g) => g.courseId === courseId && g.status === 'active').length

  const add = (event: FormEvent) => {
    event.preventDefault()
    const clean = name.trim().replace(/\s+/g, ' ')
    if (clean.length < 2) return setError('Enter the course name.')
    if (data.courses.some((c) => c.name.toLowerCase() === clean.toLowerCase())) return setError('That course is already on the list.')
    const course = actions.addCourse(clean)
    toast.show(tr("{0} added to courses. Now add its levels.", clean))
    setName('')
    // A course needs levels before it can have groups, so go straight to them.
    setEditing(course)
  }

  return (
    <Panel id="courses" title={tr("Courses")} description={tr("Shared by all branches. Used for groups, teachers and enquiries.")} flush>
      <ul className="divide-y divide-line border-t border-line">
        {data.courses.map((c) => {
          const n = groupsPer(c.id)
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className={cn('block', c.active ? 'text-ink' : 'text-ink-faint line-through')}>{c.name}</span>
                <span className="block text-xs text-ink-muted">
                  {c.levels.length ? c.levels.map((l) => (l.active ? l.name : `${l.name} (${tr('off')})`)).join(' → ') : tr("No levels yet: add some before creating groups")}
                  {c.defaultFee ? tr(" · usually {0}/month", formatUZS(c.defaultFee)) : ''}
                </span>
              </span>
              <span className="num text-xs text-ink-muted">{n ? `${n} ${plural(n, 'running group', 'running groups')}` : tr("No groups yet")}</span>
              {!c.active && <Badge>{tr("Off")}</Badge>}
              <IconButton label={tr("Edit {0}: name, levels and price", c.name)} onClick={() => setEditing(c)}>
                <Pencil />
              </IconButton>
              <Button size="sm" variant="ghost" onClick={() => actions.setCourseActive(c.id, !c.active)} aria-label={`${c.active ? tr('Turn off') : tr('Turn on')} ${c.name}`}>
                {c.active ? tr("Turn off") : tr("Turn on")}
              </Button>
            </li>
          )
        })}
      </ul>
      <form onSubmit={add} noValidate className="flex items-start gap-2 border-t border-line px-5 py-4">
        <Field label={tr("New course")} error={error || undefined} className="flex-1">
          {(p) => (
            <Input
              {...p}
              value={name}
              maxLength={60}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              placeholder={tr("e.g. Russian")}
            />
          )}
        </Field>
        <Button type="submit" className="mt-[1.6rem]">
          {tr("Add")}
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
      title={branch ? tr("Rooms at {0}", branch.name) : tr("Rooms")}
      description={tr("Groups are scheduled into these rooms; two running groups can’t share a room at the same time.")}
      actions={
        <Button size="sm" onClick={() => setEditing('new')} disabled={Boolean(needsBranch)} title={needsBranch ?? undefined}>
          {tr("Add room")}
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
                <span className="block truncate text-xs text-ink-muted">{groups.length ? groups.map((g) => g.name).join(', ') : tr("Not used by any group")}</span>
              </span>
              <span className="num text-xs text-ink-muted">{r.capacity ? tr("{0} seats", r.capacity) : ''}</span>
              <IconButton label={tr("Edit {0}", r.name)} onClick={() => setEditing(r)}>
                <Pencil />
              </IconButton>
              <IconButton
                label={groups.length ? tr("{0} is in use", r.name) : tr("Delete {0}", r.name)}
                disabled={groups.length > 0}
                onClick={() => {
                  if (actions.deleteRoom(r.id)) toast.show(tr("{0} deleted.", r.name))
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
    <Dialog open={room !== null} onClose={onClose} title={room === 'new' ? tr("Add room") : tr("Edit room")} size="sm" description={room && room !== 'new' ? tr("Renaming a room renames it on its groups too.") : undefined}>
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
    toast.show(room ? tr("Room saved.") : tr("{0} added.", clean))
    onClose()
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label={tr("Name")} error={error || undefined}>
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
            placeholder={tr("e.g. Room 106")}
          />
        )}
      </Field>
      <Field label={tr("Seats")} optional>
        {(p) => <Input {...p} type="number" inputMode="numeric" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>{tr("Cancel")}</Button>
        <Button type="submit" variant="primary">
          {room ? tr("Save") : tr("Add room")}
        </Button>
      </div>
    </form>
  )
}

/** A course's name, its levels (in teaching order) and its usual monthly fee. */
function CourseDialog({ course, onClose }: { course: Course | null; onClose: () => void }) {
  return (
    <Dialog open={course !== null} onClose={onClose} title={course ? tr("Edit course: {0}", course.name) : tr("Course")}>
      {course && <CourseForm course={course} onClose={onClose} />}
    </Dialog>
  )
}

function CourseForm({ course, onClose }: { course: Course; onClose: () => void }) {
  const { data, actions } = useSchool()
  const toast = useToast()
  const [name, setName] = useState(course.name)
  const [levels, setLevels] = useState<CourseLevel[]>(course.levels)
  const [fee, setFee] = useState(course.defaultFee ? String(course.defaultFee) : '')
  const [errors, setErrors] = useState<{ name?: string; levels?: string; fee?: string }>({})
  const groupsIn = (levelId: string) => data.groups.filter((g) => g.courseId === course.id && g.levelId === levelId).length
  const taken = new Set(data.courses.flatMap((c) => c.levels.map((l) => l.id)))

  const change = (i: number, patch: Partial<CourseLevel>) => {
    setLevels((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
    setErrors((e) => ({ ...e, levels: undefined }))
  }
  const move = (i: number, by: -1 | 1) =>
    setLevels((ls) => {
      const next = [...ls]
      const [item] = next.splice(i, 1)
      next.splice(i + by, 0, item)
      return next
    })
  const add = () => {
    const used = new Set([...taken, ...levels.map((l) => l.id)])
    setLevels((ls) => [...ls, { id: levelId(course.id, `new-${ls.length + 1}`, used), name: '', active: true }])
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const e: typeof errors = {}
    const n = fee ? Number(fee) : undefined
    if (n !== undefined && (!Number.isFinite(n) || n <= 0)) e.fee = tr("Enter the monthly fee in UZS, or leave it empty.")
    const clean = name.trim().replace(/\s+/g, ' ')
    if (clean.length < 2) e.name = tr("Enter the course name.")
    else if (data.courses.some((c) => c.id !== course.id && c.name.toLowerCase() === clean.toLowerCase())) e.name = tr("Another course already has this name.")
    const names = levels.map((l) => l.name.trim().toLowerCase())
    if (levels.length === 0) e.levels = tr("Add at least one level. Every group belongs to a level.")
    else if (names.some((x) => !x)) e.levels = tr("Every level needs a name.")
    else if (new Set(names).size !== names.length) e.levels = tr("Two levels have the same name.")
    else if (!levels.some((l) => l.active)) e.levels = tr("Keep at least one level turned on.")
    setErrors(e)
    if (Object.values(e).some(Boolean)) return
    try {
      actions.updateCourse(course.id, { name: clean, levels, defaultFee: n })
    } catch (err) {
      setErrors({ levels: err instanceof Error ? err.message : String(err) })
      return
    }
    toast.show(tr("{0} saved.", clean))
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label={tr("Course name")} error={errors.name} hint={tr("Shown everywhere this course appears. Groups, teachers and enquiries follow a rename.")}>
        {(p) => <Input {...p} value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })) }} />}
      </Field>

      <fieldset>
        <legend className="text-sm font-medium text-ink">{tr("Levels")}</legend>
        <p className="mt-0.5 text-sm text-ink-muted">{tr("In teaching order, first to last. Every group is placed in one level.")}</p>
        <ol className="mt-3 divide-y divide-line rounded-control border border-line">
          {levels.map((l, i) => {
            const used = groupsIn(l.id)
            return (
              <li key={l.id} className="flex items-center gap-2 px-3 py-2">
                <span className="num w-5 shrink-0 text-xs text-ink-faint">{i + 1}</span>
                <Input
                  aria-label={tr("Level {0} name", i + 1)}
                  value={l.name}
                  maxLength={40}
                  autoFocus={!l.name && i === levels.length - 1}
                  onChange={(e) => change(i, { name: e.target.value })}
                  placeholder={tr("e.g. Intermediate or Band 6.5")}
                  className={cn('min-w-0 flex-1', !l.active && 'text-ink-faint line-through')}
                />
                <span className="num hidden w-20 shrink-0 text-right text-xs text-ink-muted sm:block">{used ? `${used} ${plural(used, 'group', 'groups')}` : tr("No groups")}</span>
                <IconButton label={tr("Move {0} up", l.name || tr("level"))} onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp />
                </IconButton>
                <IconButton label={tr("Move {0} down", l.name || tr("level"))} onClick={() => move(i, 1)} disabled={i === levels.length - 1}>
                  <ArrowDown />
                </IconButton>
                {used ? (
                  <Button size="sm" variant="ghost" onClick={() => change(i, { active: !l.active })}>
                    {l.active ? tr("Turn off") : tr("Turn on")}
                  </Button>
                ) : (
                  <IconButton label={tr("Remove {0}", l.name || tr("level"))} onClick={() => setLevels((ls) => ls.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </IconButton>
                )}
              </li>
            )
          })}
          {levels.length === 0 && <li className="px-3 py-3 text-sm text-ink-muted">{tr("No levels yet.")}</li>}
        </ol>
        {errors.levels && <p role="alert" className="mt-1.5 text-xs text-danger">{errors.levels}</p>}
        <Button size="sm" className="mt-2" onClick={add}>
          <Plus aria-hidden />
          {tr("Add level")}
        </Button>
        <p className="mt-2 text-xs text-ink-muted">{tr("A level with groups can’t be removed, only turned off: its groups keep it, but new groups can’t choose it.")}</p>
      </fieldset>

      <Field label={tr("Usual monthly fee (UZS)")} optional error={errors.fee} hint={tr("Filled in when a new group of this course is created.")}>
        {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={10000} value={fee} onChange={(e) => setFee(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>{tr("Cancel")}</Button>
        <Button type="submit" variant="primary">
          {tr("Save")}
        </Button>
      </div>
    </form>
  )
}
