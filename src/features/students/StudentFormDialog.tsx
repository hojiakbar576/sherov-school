import { useState, type FormEvent } from 'react'
import type { Student, StudentStatus } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { toISODate } from '../../lib/dates'
import { formatPhone, formatUZS, isValidEmail, isValidPhone, studentStatusLabel } from '../../lib/format'
import { enrolmentByGroup } from '../../lib/metrics'

interface StudentFormDialogProps {
  open: boolean
  onClose: () => void
  /** Edit this student; leave empty to add a new one. */
  student?: Student
  onSaved?: (student: Student) => void
}

interface FormState {
  fullName: string
  phone: string
  email: string
  groupId: string
  enrolledOn: string
  monthlyTuition: string
  status: StudentStatus
}

type Errors = Partial<Record<keyof FormState, string>>

export function StudentFormDialog(props: StudentFormDialogProps) {
  // Remount the form each time it opens so it starts from the right values.
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.student ? 'Edit student' : 'Add student'}
      description={props.student ? props.student.fullName : 'Register a new student and place them in a group.'}
    >
      {props.open && <StudentForm {...props} />}
    </Dialog>
  )
}

function StudentForm({ onClose, student, onSaved }: StudentFormDialogProps) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const enrolment = enrolmentByGroup(data)
  const activeGroups = data.groups.filter((g) => g.status === 'active' || g.id === student?.groupId)

  const [form, setForm] = useState<FormState>(() => ({
    fullName: student?.fullName ?? '',
    phone: student?.phone ?? '',
    email: student?.email ?? '',
    groupId: student?.groupId ?? '',
    enrolledOn: student?.enrolledOn ?? toISODate(now),
    monthlyTuition: student ? String(student.monthlyTuition) : '',
    status: student?.status ?? 'active',
  }))
  const [errors, setErrors] = useState<Errors>({})
  // Tuition follows the group's fee until the user types their own amount.
  const [tuitionEdited, setTuitionEdited] = useState(Boolean(student))

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const validate = (): Errors => {
    const e: Errors = {}
    if (form.fullName.trim().length < 3) e.fullName = 'Enter the student’s full name.'
    if (!isValidPhone(form.phone)) e.phone = 'Enter a phone number like +998 90 123 45 67.'
    if (form.email.trim() && !isValidEmail(form.email.trim())) e.email = 'This email address doesn’t look right.'
    if (!form.enrolledOn) e.enrolledOn = 'Choose the enrolment date.'
    else if (form.enrolledOn > toISODate(now)) e.enrolledOn = 'Enrolment date can’t be in the future.'
    const tuition = Number(form.monthlyTuition)
    if (!form.monthlyTuition || !Number.isFinite(tuition) || tuition <= 0) e.monthlyTuition = 'Enter the monthly tuition in UZS.'
    else if (tuition > 50_000_000) e.monthlyTuition = 'That amount is too large for monthly tuition.'
    const group = data.groups.find((g) => g.id === form.groupId)
    const joiningGroup = group && form.status === 'active' && (student?.groupId !== group.id || student?.status !== 'active')
    if (group && joiningGroup && (enrolment.get(group.id) ?? 0) >= group.capacity) {
      e.groupId = `${group.name} is full (${group.capacity} seats). Choose another group or raise its capacity.`
    }
    return e
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.values(found).some(Boolean)) return

    const input = {
      fullName: form.fullName.trim().replace(/\s+/g, ' '),
      phone: formatPhone(form.phone),
      email: form.email.trim() || undefined,
      groupId: form.groupId || null,
      enrolledOn: form.enrolledOn,
      monthlyTuition: Math.round(Number(form.monthlyTuition)),
      status: form.status,
    }
    if (student) {
      actions.updateStudent(student.id, input)
      toast.show(`Saved changes to ${input.fullName}.`)
      onSaved?.({ ...input, id: student.id })
    } else {
      const created = actions.addStudent(input)
      toast.show(`${created.fullName} was added.`)
      onSaved?.(created)
    }
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" error={errors.fullName} className="sm:col-span-2">
        {(p) => <Input {...p} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="off" placeholder="e.g. Madina Karimova" autoFocus />}
      </Field>
      <Field label="Phone number" error={errors.phone}>
        {(p) => <Input {...p} type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} onBlur={() => set('phone', formatPhone(form.phone))} placeholder="+998 90 123 45 67" />}
      </Field>
      <Field label="Email" optional error={errors.email}>
        {(p) => <Input {...p} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" />}
      </Field>
      <Field label="Group" error={errors.groupId} hint="Tuition is filled in from the group’s monthly fee." className="sm:col-span-2">
        {(p) => (
          <Select
            {...p}
            value={form.groupId}
            onChange={(e) => {
              const groupId = e.target.value
              set('groupId', groupId)
              const fee = data.groups.find((g) => g.id === groupId)?.monthlyFee
              if (fee && !tuitionEdited) set('monthlyTuition', String(fee))
            }}
          >
            <option value="">No group yet</option>
            {activeGroups.map((g) => {
              const count = enrolment.get(g.id) ?? 0
              return (
                <option key={g.id} value={g.id}>
                  {g.name} ({count}/{g.capacity}){count >= g.capacity ? ', full' : ''}
                </option>
              )
            })}
          </Select>
        )}
      </Field>
      <Field label="Enrolment date" error={errors.enrolledOn}>
        {(p) => <Input {...p} type="date" max={toISODate(now)} value={form.enrolledOn} onChange={(e) => set('enrolledOn', e.target.value)} />}
      </Field>
      <Field
        label="Monthly tuition (UZS)"
        error={errors.monthlyTuition}
        hint={form.monthlyTuition && Number(form.monthlyTuition) > 0 ? formatUZS(Number(form.monthlyTuition)) : undefined}
      >
        {(p) => (
          <Input
            {...p}
            type="number"
            inputMode="numeric"
            min={0}
            step={10000}
            value={form.monthlyTuition}
            onChange={(e) => {
              setTuitionEdited(true)
              set('monthlyTuition', e.target.value)
            }}
            placeholder="450000"
          />
        )}
      </Field>
      <Field label="Status" className="sm:col-span-2">
        {(p) => (
          <Select {...p} value={form.status} onChange={(e) => set('status', e.target.value as StudentStatus)}>
            {(Object.keys(studentStatusLabel) as StudentStatus[]).map((s) => (
              <option key={s} value={s}>
                {studentStatusLabel[s]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          {student ? 'Save changes' : 'Add student'}
        </Button>
      </div>
    </form>
  )
}
