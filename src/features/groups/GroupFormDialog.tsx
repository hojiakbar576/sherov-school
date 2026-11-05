import { useState, type FormEvent } from 'react'
import type { DayPattern, Group, GroupStatus } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { dayPatternLabel, formatUZS, groupStatusLabel } from '../../lib/format'
import { enrolmentByGroup } from '../../lib/metrics'
import { findScheduleConflicts } from '../../lib/schedule'
import { timeToMinutes } from '../../lib/dates'
import { cn } from '../../lib/cn'
import { tr } from '../../i18n'

interface Props {
  open: boolean
  onClose: () => void
  group?: Group
}

export function GroupFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title={props.group ? tr("Edit group") : tr("Create group")} description={props.group?.name ?? tr("Set up a class, its teacher and its timetable.")}>
      {props.open && <GroupForm {...props} />}
    </Dialog>
  )
}

interface FormState {
  branchId: string
  name: string
  courseId: string
  levelId: string
  teacherId: string
  room: string
  days: DayPattern
  startTime: string
  durationMinutes: string
  capacity: string
  monthlyFee: string
  status: GroupStatus
}
type Errors = Partial<Record<keyof FormState, string>>

function GroupForm({ onClose, group }: Props) {
  const { data, actions, branch, user } = useSchool()
  const toast = useToast()
  const enrolled = group ? (enrolmentByGroup(data).get(group.id) ?? 0) : 0
  // Rooms are managed in Settings; an older group's room stays selectable.
  const allRooms = [...data.rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  // Course → Level → Group. Turned-off courses and levels stay selectable for the group that already uses them.
  const courses = data.courses.filter((c) => c.active || c.id === group?.courseId)

  // The owner picks the branch; an administrator always works in their own branch.
  // An existing group stays in its branch (its students, rooms and payments belong there).
  const canPickBranch = !group && user?.role === 'owner'
  const [form, setForm] = useState<FormState>(() => ({
    branchId: group?.branchId ?? branch?.id ?? (user?.role === 'owner' ? '' : (user?.branchId ?? '')),
    name: group?.name ?? '',
    courseId: group?.courseId ?? courses[0]?.id ?? '',
    // A new group must choose its level on purpose.
    levelId: group?.levelId ?? '',
    teacherId: group?.teacherId ?? '',
    room: group?.room ?? '',
    days: group?.days ?? 'odd',
    startTime: group?.startTime ?? '14:00',
    durationMinutes: String(group?.durationMinutes ?? 90),
    capacity: String(group?.capacity ?? 14),
    monthlyFee: group ? String(group.monthlyFee) : courses[0]?.defaultFee ? String(courses[0].defaultFee) : '',
    status: group?.status ?? 'active',
  }))
  // A group meets at its teacher's branch, so only that branch's rooms are offered.
  const rooms = form.branchId ? allRooms.filter((r) => r.branchId === form.branchId) : []
  const [errors, setErrors] = useState<Errors>({})
  const course = data.courses.find((c) => c.id === form.courseId)
  const levels = (course?.levels ?? []).filter((l) => l.active || l.id === group?.levelId)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // Teachers who can take the group: teaching now, or already its teacher.
  const teachers = data.teachers
    .filter((t) => (t.status === 'active' && t.branchId === form.branchId) || t.id === group?.teacherId)
    .sort((a, b) => Number(b.subject === course?.name) - Number(a.subject === course?.name) || a.fullName.localeCompare(b.fullName))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const e: Errors = {}
    const capacity = Number(form.capacity)
    const fee = Number(form.monthlyFee)
    if (form.name.trim().length < 2) e.name = tr("Give the group a name, e.g. “INT-01”.")
    else if (data.groups.some((g) => g.id !== group?.id && g.name.trim().toLowerCase() === form.name.trim().toLowerCase())) e.name = tr("Another group already has this name.")
    if (!form.branchId) e.branchId = tr("Choose the branch for this group.")
    if (!course) e.courseId = tr("Choose a course.")
    if (!levels.some((l) => l.id === form.levelId)) e.levelId = levels.length ? tr("Choose a level.") : tr("This course has no levels yet. Add them in Settings → Courses.")
    if (!form.teacherId) e.teacherId = tr("Choose a teacher.")
    if (!form.room.trim()) e.room = tr("Enter a room.")
    if (!/^\d{2}:\d{2}$/.test(form.startTime)) e.startTime = tr("Choose a start time.")
    else if (timeToMinutes(form.startTime) < 7 * 60 || timeToMinutes(form.startTime) + Number(form.durationMinutes) > 21 * 60) e.startTime = tr("Classes must run between 07:00 and 21:00.")
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 40) e.capacity = tr("Enter a capacity between 1 and 40.")
    else if (capacity < enrolled) e.capacity = tr("{0} students are already enrolled. Move some out first.", enrolled)
    if (!form.monthlyFee || !Number.isFinite(fee) || fee <= 0) e.monthlyFee = tr("Enter the monthly fee in UZS.")

    const input = {
      name: form.name.trim(),
      courseId: form.courseId,
      levelId: form.levelId,
      // The real names are copied on when the group is saved.
      subject: course?.name ?? '',
      level: levels.find((l) => l.id === form.levelId)?.name,
      teacherId: form.teacherId,
      room: form.room.trim(),
      days: form.days,
      startTime: form.startTime,
      durationMinutes: Number(form.durationMinutes),
      capacity,
      monthlyFee: Math.round(fee),
      status: form.status,
    }
    if (!e.teacherId && !e.room && !e.startTime && input.status === 'active') {
      const clash = findScheduleConflicts(
        { ...input, id: group?.id ?? '', branchId: form.branchId },
        data.groups,
      )
      if (clash.teacher) e.teacherId = tr("This teacher already has {0} at {1} on these days.", clash.teacher.name, clash.teacher.startTime)
      if (clash.room) e.room = tr("{0} is already in {1} at {2} on these days.", clash.room.name, input.room, clash.room.startTime)
    }
    setErrors(e)
    if (Object.keys(e).length) return

    if (group) {
      actions.updateGroup(group.id, input)
      toast.show(tr("Saved changes to {0}.", input.name))
    } else {
      actions.addGroup(input)
      toast.show(tr("{0} was created.", input.name))
    }
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label={tr("Group name")} error={errors.name} className="sm:col-span-2">
        {(p) => <Input {...p} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={tr("e.g. INT-01 or IELTS Evening A")} autoFocus />}
      </Field>
      <Field label={tr("Course")} error={errors.courseId}>
        {(p) => (
          <Select
            {...p}
            value={form.courseId}
            onChange={(e) => {
              const next = data.courses.find((c) => c.id === e.target.value)
              setErrors((x) => ({ ...x, courseId: undefined, levelId: undefined }))
              setForm((f) => ({
                ...f,
                courseId: e.target.value,
                levelId: '',
                // A new group starts from the course's usual fee until someone types one.
                monthlyFee: !group && next?.defaultFee && (!f.monthlyFee || f.monthlyFee === String(course?.defaultFee ?? '')) ? String(next.defaultFee) : f.monthlyFee,
              }))
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={tr("Level")} error={errors.levelId} hint={levels.length ? undefined : tr("Add levels to this course in Settings.")}>
        {(p) => (
          <Select {...p} value={form.levelId} onChange={(e) => set('levelId', e.target.value)} disabled={!levels.length}>
            <option value="">{levels.length ? tr("Choose a level") : tr("No levels yet")}</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={tr("Branch")} error={errors.branchId} hint={group ? tr("A group stays in its branch.") : undefined}>
        {(p) => (
          <Select
            {...p}
            value={form.branchId}
            disabled={!canPickBranch}
            onChange={(e) => {
              const next = e.target.value
              setErrors((x) => ({ ...x, branchId: undefined }))
              // Teachers and rooms belong to a branch, so a new branch starts them over.
              setForm((f) => ({ ...f, branchId: next, teacherId: '', room: '' }))
            }}
          >
            {!form.branchId && <option value="">{tr("Choose a branch")}</option>}
            {data.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={tr("Teacher")} error={errors.teacherId} hint={form.branchId ? undefined : tr("Choose a branch first.")}>
        {(p) => (
          <Select {...p} value={form.teacherId} disabled={!form.branchId} onChange={(e) => set('teacherId', e.target.value)}>
            <option value="">{tr("Choose a teacher")}</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName} ({t.subject})
              </option>
            ))}
          </Select>
        )}
      </Field>

      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium text-ink">{tr("Days")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(dayPatternLabel) as DayPattern[]).map((d) => (
            <label
              key={d}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-control border px-3 py-2.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand',
                form.days === d ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line-strong hover:bg-subtle',
              )}
            >
              <input type="radio" name="days" value={d} checked={form.days === d} onChange={() => set('days', d)} className="accent-brand" />
              <span>
                <span className="block font-medium">{d === 'odd' ? tr("Odd days") : tr("Even days")}</span>
                <span className="block text-xs opacity-80">{dayPatternLabel[d]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label={tr("Start time")} error={errors.startTime}>
        {(p) => <Input {...p} type="time" step={900} value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />}
      </Field>
      <Field label={tr("Length")}>
        {(p) => (
          <Select {...p} value={form.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)}>
            <option value="60">{tr("60 minutes")}</option>
            <option value="90">{tr("90 minutes")}</option>
            <option value="120">{tr("120 minutes")}</option>
          </Select>
        )}
      </Field>
      <Field
        label={tr("Room")}
        error={errors.room}
        hint={(() => {
          const room = rooms.find((r) => r.name === form.room)
          return room?.capacity && Number(form.capacity) > room.capacity
            ? `${room.name} seats ${room.capacity}, fewer than this group’s capacity.`
            : 'Add or rename rooms in Settings.'
        })()}
      >
        {(p) => (
          <Select {...p} value={form.room} disabled={!form.branchId} onChange={(e) => set('room', e.target.value)}>
            <option value="">{tr("Choose a room")}</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
                {r.capacity ? tr(" ({0} seats)", r.capacity) : ''}
              </option>
            ))}
            {form.room && !rooms.some((r) => r.name === form.room) && <option value={form.room}>{form.room}</option>}
          </Select>
        )}
      </Field>
      <Field label={tr("Capacity")} error={errors.capacity} hint={group ? tr("{0} enrolled now", enrolled) : undefined}>
        {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={40} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />}
      </Field>
      <Field label={tr("Monthly fee (UZS)")} error={errors.monthlyFee} hint={Number(form.monthlyFee) > 0 ? tr("{0}. New students start with this fee.", formatUZS(Number(form.monthlyFee))) : tr("New students start with this fee.")}>
        {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={10000} value={form.monthlyFee} onChange={(e) => set('monthlyFee', e.target.value)} placeholder="450000" />}
      </Field>
      <Field label={tr("Status")} hint={tr("Only running groups appear on the schedule.")}>
        {(p) => (
          <Select {...p} value={form.status} onChange={(e) => set('status', e.target.value as GroupStatus)}>
            {(Object.keys(groupStatusLabel) as GroupStatus[]).map((s) => (
              <option key={s} value={s}>
                {groupStatusLabel[s]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
        <Button onClick={onClose}>{tr("Cancel")}</Button>
        <Button type="submit" variant="primary">
          {group ? tr("Save changes") : tr("Create group")}
        </Button>
      </div>
    </form>
  )
}
