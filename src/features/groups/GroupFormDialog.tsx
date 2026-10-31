import { useState, type FormEvent } from 'react'
import type { DayPattern, Group, GroupStatus, Subject } from '../../types'
import { SUBJECTS } from '../../types'
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

interface Props {
  open: boolean
  onClose: () => void
  group?: Group
}

export function GroupFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title={props.group ? 'Edit group' : 'Create group'} description={props.group?.name ?? 'Set up a class, its teacher and its timetable.'}>
      {props.open && <GroupForm {...props} />}
    </Dialog>
  )
}

interface FormState {
  name: string
  subject: Subject
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
  const { data, actions } = useSchool()
  const toast = useToast()
  const enrolled = group ? (enrolmentByGroup(data).get(group.id) ?? 0) : 0
  const rooms = Array.from(new Set(data.groups.map((g) => g.room))).sort()

  const [form, setForm] = useState<FormState>(() => ({
    name: group?.name ?? '',
    subject: group?.subject ?? 'English',
    teacherId: group?.teacherId ?? '',
    room: group?.room ?? '',
    days: group?.days ?? 'odd',
    startTime: group?.startTime ?? '14:00',
    durationMinutes: String(group?.durationMinutes ?? 90),
    capacity: String(group?.capacity ?? 14),
    monthlyFee: group ? String(group.monthlyFee) : '',
    status: group?.status ?? 'active',
  }))
  const [errors, setErrors] = useState<Errors>({})

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // Teachers who can take the group: teaching now, or already its teacher.
  const teachers = data.teachers
    .filter((t) => t.status === 'active' || t.id === group?.teacherId)
    .sort((a, b) => Number(b.subject === form.subject) - Number(a.subject === form.subject) || a.fullName.localeCompare(b.fullName))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const e: Errors = {}
    const capacity = Number(form.capacity)
    const fee = Number(form.monthlyFee)
    if (form.name.trim().length < 3) e.name = 'Give the group a name, e.g. “English Intermediate”.'
    else if (data.groups.some((g) => g.id !== group?.id && g.name.trim().toLowerCase() === form.name.trim().toLowerCase())) e.name = 'Another group already has this name.'
    if (!form.teacherId) e.teacherId = 'Choose a teacher.'
    if (!form.room.trim()) e.room = 'Enter a room.'
    if (!/^\d{2}:\d{2}$/.test(form.startTime)) e.startTime = 'Choose a start time.'
    else if (timeToMinutes(form.startTime) < 7 * 60 || timeToMinutes(form.startTime) + Number(form.durationMinutes) > 21 * 60) e.startTime = 'Classes must run between 07:00 and 21:00.'
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 40) e.capacity = 'Enter a capacity between 1 and 40.'
    else if (capacity < enrolled) e.capacity = `${enrolled} students are already enrolled. Move some out first.`
    if (!form.monthlyFee || !Number.isFinite(fee) || fee <= 0) e.monthlyFee = 'Enter the monthly fee in UZS.'

    const input = {
      name: form.name.trim(),
      subject: form.subject,
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
        { ...input, id: group?.id ?? '', branchId: data.teachers.find((t) => t.id === input.teacherId)?.branchId ?? '' },
        data.groups,
      )
      if (clash.teacher) e.teacherId = `This teacher already has ${clash.teacher.name} at ${clash.teacher.startTime} on these days.`
      if (clash.room) e.room = `${clash.room.name} is already in ${input.room} at ${clash.room.startTime} on these days.`
    }
    setErrors(e)
    if (Object.keys(e).length) return

    if (group) {
      actions.updateGroup(group.id, input)
      toast.show(`Saved changes to ${input.name}.`)
    } else {
      actions.addGroup(input)
      toast.show(`${input.name} was created.`)
    }
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Group name" error={errors.name} className="sm:col-span-2">
        {(p) => <Input {...p} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. IELTS Foundation 5.5" autoFocus />}
      </Field>
      <Field label="Subject">
        {(p) => (
          <Select {...p} value={form.subject} onChange={(e) => set('subject', e.target.value as Subject)}>
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Teacher" error={errors.teacherId}>
        {(p) => (
          <Select {...p} value={form.teacherId} onChange={(e) => set('teacherId', e.target.value)}>
            <option value="">Choose a teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName} ({t.subject})
              </option>
            ))}
          </Select>
        )}
      </Field>

      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium text-ink">Days</legend>
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
                <span className="block font-medium">{d === 'odd' ? 'Odd days' : 'Even days'}</span>
                <span className="block text-xs opacity-80">{dayPatternLabel[d]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Start time" error={errors.startTime}>
        {(p) => <Input {...p} type="time" step={900} value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />}
      </Field>
      <Field label="Length">
        {(p) => (
          <Select {...p} value={form.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)}>
            <option value="60">60 minutes</option>
            <option value="90">90 minutes</option>
            <option value="120">120 minutes</option>
          </Select>
        )}
      </Field>
      <Field label="Room" error={errors.room}>
        {(p) => (
          <>
            <Input {...p} list="room-options" value={form.room} onChange={(e) => set('room', e.target.value)} placeholder="e.g. Room 101" />
            <datalist id="room-options">
              {rooms.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <Field label="Capacity" error={errors.capacity} hint={group ? `${enrolled} enrolled now` : undefined}>
        {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={40} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />}
      </Field>
      <Field label="Monthly fee (UZS)" error={errors.monthlyFee} hint={Number(form.monthlyFee) > 0 ? `${formatUZS(Number(form.monthlyFee))}. New students start with this fee.` : 'New students start with this fee.'}>
        {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={10000} value={form.monthlyFee} onChange={(e) => set('monthlyFee', e.target.value)} placeholder="450000" />}
      </Field>
      <Field label="Status" hint="Only running groups appear on the schedule.">
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
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          {group ? 'Save changes' : 'Create group'}
        </Button>
      </div>
    </form>
  )
}
