import { useState, type FormEvent } from 'react'
import type { Gender, Guardian, GuardianRelationship, Student, TuitionAdjustmentKind } from '../../types'
import { GUARDIAN_RELATIONSHIPS } from '../../types'
import { useSchool, type StudentInput } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { toISODate } from '../../lib/dates'
import { formatPhone, formatUZS, genderLabel, guardianRelationshipLabel, isValidEmail, isValidPhone, tuitionAdjustmentLabel } from '../../lib/format'
import { createId } from '../../lib/id'
import { TagPicker } from './StudentTags'
import { enrolmentByGroup } from '../../lib/metrics'
import { tr } from '../../i18n'

interface StudentFormDialogProps {
  open: boolean
  onClose: () => void
  /** Edit this student; leave empty to add a new one. */
  student?: Student
  onSaved?: (student: Student) => void
  /** Pre-fills a new student, e.g. from an admissions enquiry. */
  initial?: { fullName?: string; parentName?: string; parentPhone?: string; groupId?: string }
  /** Creates the student another way (e.g. enrolling an enquiry). Defaults to adding a student. */
  create?: (input: StudentInput) => Student
  title?: string
}

interface GuardianRow {
  id: string
  fullName: string
  relationship: GuardianRelationship
  phone: string
  altPhone: string
}

interface FormState {
  fullName: string
  phone: string
  email: string
  dateOfBirth: string
  gender: Gender | ''
  address: string
  guardians: GuardianRow[]
  groupId: string
  enrolledOn: string
  monthlyTuition: string
  tags: string[]
  adjustmentKind: TuitionAdjustmentKind
  adjustmentReason: string
}

type Errors = Partial<Record<Exclude<keyof FormState, 'guardians'>, string>> & { guardians?: Record<number, { fullName?: string; phone?: string; altPhone?: string }> }

const emptyGuardian = (relationship: GuardianRelationship): GuardianRow => ({ id: createId('gdn'), fullName: '', relationship, phone: '', altPhone: '' })
const isBlank = (g: GuardianRow) => !g.fullName.trim() && !g.phone.trim() && !g.altPhone.trim()

export function StudentFormDialog(props: StudentFormDialogProps) {
  // Remount the form each time it opens so it starts from the right values.
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.title ?? (props.student ? tr("Edit student") : tr("Add student"))}
      description={props.student ? props.student.fullName : tr("Four short steps: the student, a parent, the group and tuition.")}
      size="lg"
    >
      {props.open && <StudentForm {...props} />}
    </Dialog>
  )
}

function StudentForm({ onClose, student, onSaved, initial, create }: StudentFormDialogProps) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const enrolment = enrolmentByGroup(data)
  const activeGroups = data.groups.filter((g) => g.status === 'active' || g.id === student?.groupId)

  const [form, setForm] = useState<FormState>(() => ({
    fullName: student?.fullName ?? initial?.fullName ?? '',
    phone: student?.phone ?? '',
    email: student?.email ?? '',
    dateOfBirth: student?.dateOfBirth ?? '',
    gender: student?.gender ?? '',
    address: student?.address ?? '',
    guardians: student?.guardians.length
      ? student.guardians.map((g) => ({ id: g.id, fullName: g.fullName, relationship: g.relationship, phone: g.phone, altPhone: g.altPhone ?? '' }))
      : initial?.parentName || initial?.parentPhone
        ? [{ ...emptyGuardian('mother'), fullName: initial.parentName ?? '', phone: initial.parentPhone ?? '' }]
        : [emptyGuardian('mother')],
    groupId: student?.groupId ?? initial?.groupId ?? '',
    enrolledOn: student?.enrolledOn ?? toISODate(now),
    monthlyTuition: student ? String(student.monthlyTuition) : String(data.groups.find((g) => g.id === initial?.groupId)?.monthlyFee ?? ''),
    adjustmentKind: student?.tuitionAdjustment?.kind ?? 'discount',
    adjustmentReason: student?.tuitionAdjustment?.reason ?? '',
    tags: student?.tags ?? [],
  }))
  // The standard price is the group's fee; anything else needs a reason.
  const standardFee = data.groups.find((g) => g.id === form.groupId)?.monthlyFee
  const priceDiffers = standardFee !== undefined && Number(form.monthlyTuition) > 0 && Number(form.monthlyTuition) !== standardFee
  const [errors, setErrors] = useState<Errors>({})
  // Tuition follows the group's fee until the user types their own amount.
  const [tuitionEdited, setTuitionEdited] = useState(Boolean(student))

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (key !== 'guardians' && errors[key as Exclude<K, 'guardians'>]) setErrors((e) => ({ ...e, [key]: undefined }))
  }
  const setGuardian = (index: number, patch: Partial<GuardianRow>) => {
    setForm((f) => ({ ...f, guardians: f.guardians.map((g, i) => (i === index ? { ...g, ...patch } : g)) }))
    if (errors.guardians?.[index]) setErrors((e) => ({ ...e, guardians: { ...e.guardians, [index]: {} } }))
  }

  const validate = (): Errors => {
    const e: Errors = {}
    if (form.fullName.trim().length < 3) e.fullName = tr("Enter the student’s full name.")
    if (!isValidPhone(form.phone)) e.phone = tr("Enter a phone number like +998 90 123 45 67.")
    if (form.email.trim() && !isValidEmail(form.email.trim())) e.email = tr("This email address doesn’t look right.")
    if (form.dateOfBirth && form.dateOfBirth >= toISODate(now)) e.dateOfBirth = tr("Date of birth must be in the past.")
    // A parent row is optional (adult students), but a started one must be complete.
    form.guardians.forEach((g, i) => {
      if (isBlank(g)) return
      const ge: { fullName?: string; phone?: string; altPhone?: string } = {}
      if (g.fullName.trim().length < 3) ge.fullName = tr("Enter the parent’s full name.")
      if (!isValidPhone(g.phone)) ge.phone = tr("Enter a phone like +998 90 123 45 67.")
      if (g.altPhone.trim() && !isValidPhone(g.altPhone)) ge.altPhone = tr("This number doesn’t look right.")
      if (Object.keys(ge).length) e.guardians = { ...e.guardians, [i]: ge }
    })
    if (!form.enrolledOn) e.enrolledOn = tr("Choose the enrolment date.")
    else if (form.enrolledOn > toISODate(now)) e.enrolledOn = tr("Enrolment date can’t be in the future.")
    const tuition = Number(form.monthlyTuition)
    if (!form.monthlyTuition || !Number.isFinite(tuition) || tuition <= 0) e.monthlyTuition = tr("Enter the monthly tuition in UZS.")
    else if (tuition > 50_000_000) e.monthlyTuition = tr("That amount is too large for monthly tuition.")
    if (priceDiffers && form.adjustmentReason.trim().length < 3) e.adjustmentReason = tr("Say why this student pays a different price.")
    const group = data.groups.find((g) => g.id === form.groupId)
    const joiningGroup = group && !student
    if (group && joiningGroup && (enrolment.get(group.id) ?? 0) >= group.capacity) {
      e.groupId = tr("{0} is full ({1} seats). Choose another group or raise its capacity.", group.name, group.capacity)
    }
    return e
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    const guardianErrors = Object.values(found.guardians ?? {}).some((g) => Object.keys(g).length > 0)
    if (Object.entries(found).some(([k, v]) => k !== 'guardians' && Boolean(v)) || guardianErrors) return

    const guardians: Guardian[] = form.guardians
      .filter((g) => !isBlank(g))
      .map((g) => ({
        id: g.id,
        fullName: g.fullName.trim().replace(/\s+/g, ' '),
        relationship: g.relationship,
        phone: formatPhone(g.phone),
        ...(g.altPhone.trim() ? { altPhone: formatPhone(g.altPhone) } : {}),
      }))

    const input = {
      fullName: form.fullName.trim().replace(/\s+/g, ' '),
      phone: formatPhone(form.phone),
      email: form.email.trim() || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      gender: form.gender || undefined,
      address: form.address.trim() || undefined,
      guardians,
      // Group and status change through Transfer and Change status, so they keep their history.
      groupId: student ? student.groupId : form.groupId || null,
      enrolledOn: form.enrolledOn,
      monthlyTuition: Math.round(Number(form.monthlyTuition)),
      ...(priceDiffers ? { tuitionAdjustment: { kind: form.adjustmentKind, reason: form.adjustmentReason.trim() } } : {}),
      status: student ? student.status : ('active' as const),
      ...(form.tags.length ? { tags: form.tags } : {}),
    }
    if (student) {
      actions.updateStudent(student.id, input)
      toast.show(tr("Saved changes to {0}.", input.fullName))
      onSaved?.({ ...student, ...input })
    } else {
      const created = (create ?? actions.addStudent)(input)
      toast.show(tr("{0} was added.", created.fullName))
      onSaved?.(created)
    }
    onClose()
  }

  const gErr = (i: number) => errors.guardians?.[i] ?? {}

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Section step={1} title={tr("Student")}>
        <Field label={tr("Full name")} error={errors.fullName} className="sm:col-span-2">
          {(p) => <Input {...p} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="off" placeholder={tr("e.g. Madina Karimova")} autoFocus />}
        </Field>
        <Field label={tr("Student’s phone")} error={errors.phone}>
          {(p) => <Input {...p} type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} onBlur={() => set('phone', formatPhone(form.phone))} placeholder="+998 90 123 45 67" />}
        </Field>
        <Field label={tr("Date of birth")} optional error={errors.dateOfBirth}>
          {(p) => <Input {...p} type="date" max={toISODate(now)} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />}
        </Field>
        <Field label={tr("Gender")} optional>
          {(p) => (
            <Select {...p} value={form.gender} onChange={(e) => set('gender', e.target.value as Gender | '')}>
              <option value="">{tr("Not given")}</option>
              {(Object.keys(genderLabel) as Gender[]).map((g) => (
                <option key={g} value={g}>
                  {genderLabel[g]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={tr("Email")} optional error={errors.email}>
          {(p) => <Input {...p} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder={tr("name@example.com")} />}
        </Field>
        <Field label={tr("Address")} optional className="sm:col-span-2">
          {(p) => <Input {...p} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder={tr("District, street")} />}
        </Field>
      </Section>

      <Section step={2} title={tr("Parent / guardian")} hint={tr("Who to call about this student. Leave empty for adult students.")}>
        {form.guardians.map((g, i) => (
          <div key={g.id} className="grid gap-4 rounded-panel border border-line bg-canvas p-4 sm:col-span-2 sm:grid-cols-2">
            <div className="flex items-center justify-between sm:col-span-2">
              <p className="text-sm font-medium text-ink">{i === 0 ? tr("Main contact") : tr("Second contact")}</p>
              {i > 0 && (
                <button type="button" onClick={() => set('guardians', form.guardians.filter((_, j) => j !== i))} className="text-sm text-ink-muted hover:text-danger">
                  {tr("Remove")}
                </button>
              )}
            </div>
            <Field label={tr("Full name")} error={gErr(i).fullName}>
              {(p) => <Input {...p} value={g.fullName} onChange={(e) => setGuardian(i, { fullName: e.target.value })} placeholder={tr("e.g. Dilnoza Karimova")} />}
            </Field>
            <Field label={tr("Relationship")}>
              {(p) => (
                <Select {...p} value={g.relationship} onChange={(e) => setGuardian(i, { relationship: e.target.value as GuardianRelationship })}>
                  {GUARDIAN_RELATIONSHIPS.map((r) => (
                    <option key={r} value={r}>
                      {guardianRelationshipLabel[r]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={tr("Phone")} error={gErr(i).phone}>
              {(p) => <Input {...p} type="tel" inputMode="tel" value={g.phone} onChange={(e) => setGuardian(i, { phone: e.target.value })} onBlur={() => setGuardian(i, { phone: formatPhone(g.phone) })} placeholder="+998 90 123 45 67" />}
            </Field>
            <Field label={tr("Second phone")} optional error={gErr(i).altPhone}>
              {(p) => <Input {...p} type="tel" inputMode="tel" value={g.altPhone} onChange={(e) => setGuardian(i, { altPhone: e.target.value })} onBlur={() => setGuardian(i, { altPhone: g.altPhone ? formatPhone(g.altPhone) : '' })} placeholder={tr("Work or another number")} />}
            </Field>
          </div>
        ))}
        {form.guardians.length < 3 && (
          <div className="sm:col-span-2">
            <Button size="sm" onClick={() => set('guardians', [...form.guardians, emptyGuardian(form.guardians.some((g) => g.relationship === 'father') ? 'mother' : 'father')])}>
              {tr("+ Add")}{' '}{form.guardians.length === 0 ? tr("a parent") : tr("another parent")}
            </Button>
          </div>
        )}
      </Section>

      <Section step={3} title={tr("Group")}>
        {student ? (
          <p className="rounded-control bg-subtle px-3 py-2.5 text-sm text-ink-muted sm:col-span-2">
            {student.groupId ? <>{tr("In")}{' '}<span className="font-medium text-ink">{data.groups.find((g) => g.id === student.groupId)?.name}</span>. </> : tr("Not in a group. ")}
            {tr("To move them to another group or change their status, use")}{' '}<span className="font-medium text-ink">{tr("Transfer")}</span>{' '}{tr("or")}{' '}
            <span className="font-medium text-ink">{tr("Change status")}</span>{' '}{tr("on their profile, so the history is kept.")}
          </p>
        ) : (
        <Field label={tr("Group")} error={errors.groupId} hint={tr("Tuition below is filled in from the group’s monthly fee.")} className="sm:col-span-2">
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
              <option value="">{tr("No group yet")}</option>
              {activeGroups.map((g) => {
                const count = enrolment.get(g.id) ?? 0
                return (
                  <option key={g.id} value={g.id}>
                    {g.name} ({count}/{g.capacity}){count >= g.capacity ? tr(", full") : ''}
                  </option>
                )
              })}
            </Select>
          )}
        </Field>
        )}
        <Field label={tr("Enrolment date")} error={errors.enrolledOn}>
          {(p) => <Input {...p} type="date" max={toISODate(now)} value={form.enrolledOn} onChange={(e) => set('enrolledOn', e.target.value)} />}
        </Field>
      </Section>

      <Section step={4} title={tr("Tuition and tags")}>
        <Field
          label={tr("Monthly tuition (UZS)")}
          error={errors.monthlyTuition}
          hint={
            standardFee !== undefined ? tr("The group’s standard fee is {0}.{1}", formatUZS(standardFee), priceDiffers ? '' : tr(" Change it for a discount or special price.")) : form.monthlyTuition && Number(form.monthlyTuition) > 0 ? tr("{0} a month.", formatUZS(Number(form.monthlyTuition))) : undefined
          }
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
        {priceDiffers && (
          <>
            <Field label={tr("Why a different price")}>
              {(p) => (
                <Select {...p} value={form.adjustmentKind} onChange={(e) => set('adjustmentKind', e.target.value as TuitionAdjustmentKind)}>
                  {(Object.keys(tuitionAdjustmentLabel) as TuitionAdjustmentKind[]).map((k) => (
                    <option key={k} value={k}>
                      {tuitionAdjustmentLabel[k]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={tr("Reason")} error={errors.adjustmentReason} hint={tr("Shown on the profile so everyone knows why the price differs.")}>
              {(p) => <Input {...p} value={form.adjustmentReason} maxLength={160} onChange={(e) => set('adjustmentReason', e.target.value)} placeholder={tr("e.g. Sibling discount")} />}
            </Field>
          </>
        )}
      </Section>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-ink">{tr("Tags")}{' '}<span className="font-normal text-ink-muted">{tr("· optional labels you can filter the student list by")}</span></p>
        <TagPicker value={form.tags} onChange={(tags) => set('tags', tags)} />
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>{tr("Cancel")}</Button>
        <Button type="submit" variant="primary">
          {student ? tr("Save changes") : tr("Add student")}
        </Button>
      </div>
    </form>
  )
}

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="mb-3 flex items-center gap-2.5 sm:col-span-2">
        <span className="num flex size-6 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink">{step}</span>
        <span className="font-semibold text-ink">{title}</span>
        {hint && <span className="text-sm text-ink-muted">· {hint}</span>}
      </legend>
      {children}
    </fieldset>
  )
}
