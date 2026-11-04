import { useState, type FormEvent } from 'react'
import type { Subject, Teacher, TeacherStatus, SalaryKind } from '../../types'
import { useSchool, type TeacherInput } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { toISODate } from '../../lib/dates'
import { DEFAULT_SALARY_PERCENT } from '../../data/seed-learning'
import { formatPhone, isValidEmail, isValidPhone, teacherStatusLabel } from '../../lib/format'

interface Props {
  open: boolean
  onClose: () => void
  teacher?: Teacher
}

export function TeacherFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title={props.teacher ? 'Edit teacher' : 'Add teacher'} description={props.teacher?.fullName}>
      {props.open && <TeacherForm {...props} />}
    </Dialog>
  )
}

type FormState = TeacherInput
type Errors = Partial<Record<keyof FormState, string>>

function TeacherForm({ onClose, teacher }: Props) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const [form, setForm] = useState<FormState>(() => ({
    fullName: teacher?.fullName ?? '',
    subject: teacher?.subject ?? 'English',
    phone: teacher?.phone ?? '',
    email: teacher?.email ?? '',
    status: teacher?.status ?? 'active',
    joinedOn: teacher?.joinedOn ?? toISODate(now),
    salaryPercent: teacher?.salaryPercent ?? DEFAULT_SALARY_PERCENT,
    salaryKind: teacher?.salaryKind ?? 'percent',
    fixedSalary: teacher?.fixedSalary ?? 0,
  }))
  const [errors, setErrors] = useState<Errors>({})

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const e: Errors = {}
    if (form.fullName.trim().length < 3) e.fullName = 'Enter the teacher’s full name.'
    if (!isValidPhone(form.phone)) e.phone = 'Enter a phone number like +998 90 123 45 67.'
    if (!isValidEmail(form.email.trim())) e.email = 'Enter a valid email address.'
    if (!form.joinedOn) e.joinedOn = 'Choose the start date.'
    if (form.salaryKind !== 'fixed' && (!Number.isFinite(form.salaryPercent) || form.salaryPercent < 0 || form.salaryPercent > 100)) e.salaryPercent = 'Enter a share from 0 to 100.'
    if (form.salaryKind !== 'percent' && (!Number.isFinite(form.fixedSalary) || (form.fixedSalary ?? 0) <= 0)) e.fixedSalary = 'Enter the fixed monthly amount.'
    setErrors(e)
    if (Object.keys(e).length) return

    const input = { ...form, fullName: form.fullName.trim().replace(/\s+/g, ' '), phone: formatPhone(form.phone), email: form.email.trim() }
    if (teacher) {
      actions.updateTeacher(teacher.id, input)
      toast.show(`Saved changes to ${input.fullName}.`)
    } else {
      actions.addTeacher(input)
      toast.show(`${input.fullName} was added.`)
    }
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" error={errors.fullName} className="sm:col-span-2">
        {(p) => <Input {...p} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="e.g. Kamola Yusupova" autoFocus />}
      </Field>
      <Field label="Subject">
        {(p) => (
          <Select {...p} value={form.subject} onChange={(e) => set('subject', e.target.value as Subject)}>
            {data.courses.filter((c) => c.active || c.name === form.subject).map((c) => c.name).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Status" hint="Teachers on leave can't be assigned new groups.">
        {(p) => (
          <Select {...p} value={form.status} onChange={(e) => set('status', e.target.value as TeacherStatus)}>
            {(Object.keys(teacherStatusLabel) as TeacherStatus[]).map((s) => (
              <option key={s} value={s}>
                {teacherStatusLabel[s]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Phone number" error={errors.phone}>
        {(p) => <Input {...p} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} onBlur={() => set('phone', formatPhone(form.phone))} placeholder="+998 90 123 45 67" />}
      </Field>
      <Field label="Email" error={errors.email}>
        {(p) => <Input {...p} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@sherovschool.uz" />}
      </Field>
      <Field label="Teaching since" error={errors.joinedOn}>
        {(p) => <Input {...p} type="date" value={form.joinedOn} onChange={(e) => set('joinedOn', e.target.value)} />}
      </Field>
      <Field label="Pay rule" hint="How the monthly salary is worked out." className="sm:col-span-2">
        {(p) => (
          <Select {...p} value={form.salaryKind} onChange={(e) => set('salaryKind', e.target.value as SalaryKind)}>
            <option value="percent">Share of paid tuition</option>
            <option value="fixed">Fixed monthly salary</option>
            <option value="mixed">Fixed amount plus a share of tuition</option>
          </Select>
        )}
      </Field>
      {form.salaryKind !== 'percent' && (
        <Field label="Fixed amount a month (UZS)" error={errors.fixedSalary}>
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={0}
              step={100000}
              value={Number.isFinite(form.fixedSalary) && form.fixedSalary ? form.fixedSalary : ''}
              onChange={(e) => set('fixedSalary', e.target.value === '' ? Number.NaN : Number(e.target.value))}
            />
          )}
        </Field>
      )}
      {form.salaryKind !== 'fixed' && (
      <Field label="Salary share (%)" hint="Part of each student's paid tuition the teacher earns." error={errors.salaryPercent}>
        {(p) => (
          <Input
            {...p}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={Number.isFinite(form.salaryPercent) ? form.salaryPercent : ''}
            onChange={(e) => set('salaryPercent', e.target.value === '' ? Number.NaN : Number(e.target.value))}
          />
        )}
      </Field>
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          {teacher ? 'Save changes' : 'Add teacher'}
        </Button>
      </div>
    </form>
  )
}
