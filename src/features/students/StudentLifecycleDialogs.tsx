import { useState, type FormEvent } from 'react'
import type { Student, StudentStatus } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { isValidISODate, toISODate } from '../../lib/dates'
import { formatUZS, studentStatusLabel } from '../../lib/format'
import { enrolmentByGroup } from '../../lib/metrics'
import { cn } from '../../lib/cn'
import { tr } from '../../i18n'

// ---------------------------------------------------------------- transfer

/** Move a student to another group. The old group stays in their history. */
export function TransferDialog({ open, onClose, student }: { open: boolean; onClose: () => void; student: Student }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={student.groupId ? tr("Transfer to another group") : tr("Add to a group")}
      description={tr("{0}. Their attendance, grades and payments stay with them.", student.fullName)}
    >
      {open && <TransferForm student={student} onClose={onClose} />}
    </Dialog>
  )
}

function TransferForm({ student, onClose }: { student: Student; onClose: () => void }) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const enrolment = enrolmentByGroup(data)
  const current = data.groups.find((g) => g.id === student.groupId)
  const options = data.groups
    .filter((g) => g.status === 'active' && g.id !== student.groupId)
    .sort((a, b) => Number(b.subject === current?.subject) - Number(a.subject === current?.subject) || a.name.localeCompare(b.name))
  const [toGroupId, setToGroupId] = useState('')
  const [on, setOn] = useState(toISODate(now))
  const [reason, setReason] = useState('')
  // A student paying the old group's standard fee moves to the new group's fee.
  const onStandardFee = !student.tuitionAdjustment && (!current || current.monthlyFee === student.monthlyTuition)
  const [keepPrice, setKeepPrice] = useState(!onStandardFee)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const target = data.groups.find((g) => g.id === toGroupId)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const e: Record<string, string> = {}
    if (!target) e.group = tr("Choose the new group.")
    else if ((enrolment.get(target.id) ?? 0) >= target.capacity) e.group = tr("{0} is full ({1} seats).", target.name, target.capacity)
    if (!isValidISODate(on)) e.on = tr("Choose the date of the move.")
    else if (on < student.enrolledOn) e.on = tr("The move can’t be before they enrolled.")
    setErrors(e)
    if (Object.keys(e).length || !target) return
    actions.transferStudent(student.id, {
      toGroupId: target.id,
      on,
      reason,
      ...(keepPrice ? {} : { monthlyTuition: target.monthlyFee }),
    })
    toast.show(tr("{0} moved to {1}.", student.fullName, target.name))
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {current && (
        <p className="rounded-control bg-subtle px-3 py-2 text-sm text-ink-muted">
          {tr("Now in")}{' '}<span className="font-medium text-ink">{current.name}</span> ({current.subject}, {current.startTime}).
        </p>
      )}
      <Field label={tr("New group")} error={errors.group}>
        {(p) => (
          <Select
            {...p}
            value={toGroupId}
            onChange={(ev) => {
              setToGroupId(ev.target.value)
              setErrors((x) => ({ ...x, group: '' }))
            }}
          >
            <option value="">{tr("Choose a group")}</option>
            {options.map((g) => {
              const n = enrolment.get(g.id) ?? 0
              return (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.subject}, {g.startTime} ({n}/{g.capacity}){n >= g.capacity ? tr(", full") : ''}
                </option>
              )
            })}
          </Select>
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tr("First day in the new group")} error={errors.on}>
          {(p) => <Input {...p} type="date" value={on} onChange={(ev) => setOn(ev.target.value)} />}
        </Field>
        <Field label={tr("Reason")} optional>
          {(p) => <Input {...p} value={reason} maxLength={160} onChange={(ev) => setReason(ev.target.value)} placeholder={tr("e.g. Level went up")} />}
        </Field>
      </div>
      {target && target.monthlyFee !== student.monthlyTuition && (
        <fieldset className="rounded-control border border-line p-3 text-sm">
          <legend className="px-1 font-medium text-ink">{tr("Monthly tuition")}</legend>
          <label className="flex items-center gap-2 py-1">
            <input type="radio" name="price" checked={!keepPrice} onChange={() => setKeepPrice(false)} className="accent-[var(--color-brand)]" />
            {tr("Switch to")}{' '}{target.name}{tr("’s fee:")}{' '}<span className="num font-medium">{formatUZS(target.monthlyFee)}</span>
          </label>
          <label className="flex items-center gap-2 py-1">
            <input type="radio" name="price" checked={keepPrice} onChange={() => setKeepPrice(true)} className="accent-[var(--color-brand)]" />
            {tr("Keep their current price:")}{' '}<span className="num font-medium">{formatUZS(student.monthlyTuition)}</span>
            {student.tuitionAdjustment && <span className="text-ink-muted">({student.tuitionAdjustment.reason})</span>}
          </label>
        </fieldset>
      )}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>{tr("Cancel")}</Button>
        <Button type="submit" variant="primary">
          {student.groupId ? tr("Transfer") : tr("Add to group")}
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------- status

const CHOICES: { status: StudentStatus; title: string; detail: string }[] = [
  { status: 'active', title: tr("Active"), detail: tr("Studying and billed every month.") },
  { status: 'paused', title: tr("Paused (frozen)"), detail: tr("Keeps their seat in the group but isn’t billed, e.g. during exams or travel.") },
  { status: 'left', title: tr("Left"), detail: tr("Stopped studying. Leaves the group and moves to the archive with all history.") },
  { status: 'graduated', title: tr("Graduated"), detail: tr("Finished their course. Leaves the group and moves to the archive.") },
]

/** Pause, leave, graduate or come back. Always dated and kept in the history. */
export function StatusDialog({ open, onClose, student }: { open: boolean; onClose: () => void; student: Student }) {
  return (
    <Dialog open={open} onClose={onClose} title={tr("Change status")} description={tr("{0} is {1} now.", student.fullName, studentStatusLabel[student.status].toLowerCase())}>
      {open && <StatusForm student={student} onClose={onClose} />}
    </Dialog>
  )
}

function StatusForm({ student, onClose }: { student: Student; onClose: () => void }) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const [status, setStatus] = useState<StudentStatus>(student.status === 'active' ? 'paused' : 'active')
  const [on, setOn] = useState(toISODate(now))
  const [reason, setReason] = useState('')
  const [choice, setChoice] = useState('')
  const [error, setError] = useState('')
  const needsReason = status === 'left' || status === 'paused'
  // The school's own list of reasons for freezing or leaving (Settings → Lists).
  const reasons = (status === 'left' ? data.catalogs.leaveReasons : status === 'paused' ? data.catalogs.pauseReasons : []).filter((r) => r.active)
  const chosen = reasons.find((r) => r.id === choice)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!isValidISODate(on)) return setError('Choose a date.')
    const full = [chosen?.name, reason.trim()].filter(Boolean).join(': ')
    if (needsReason && full.length < 3) return setError('Choose or write a reason, so the history makes sense later.')
    actions.changeStudentStatus(student.id, status, on, full)
    toast.show(tr("{0} is now {1}.", student.fullName, studentStatusLabel[status].toLowerCase()))
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{tr("New status")}</legend>
        <div className="space-y-2">
          {CHOICES.filter((c) => c.status !== student.status).map((c) => (
            <label
              key={c.status}
              className={cn('flex cursor-pointer gap-3 rounded-control border p-3', status === c.status ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong')}
            >
              <input type="radio" name="status" checked={status === c.status} onChange={() => setStatus(c.status)} className="mt-1 accent-[var(--color-brand)]" />
              <span>
                <span className="block text-sm font-medium text-ink">{c.title}</span>
                <span className="block text-sm text-ink-muted">{c.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {status === 'active' && !student.groupId && (
        <p className="text-sm text-ink-muted">{tr("They’re not in a group. After this, use Transfer to add them to one.")}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tr("From")}>
          {(p) => <Input {...p} type="date" value={on} onChange={(e) => setOn(e.target.value)} />}
        </Field>
        {reasons.length > 0 && (
          <Field label={tr("Reason")}>
            {(p) => (
              <Select
                {...p}
                value={choice}
                onChange={(e) => {
                  setChoice(e.target.value)
                  setError('')
                }}
              >
                <option value="">{tr("Choose a reason")}</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label={reasons.length ? tr("Details") : tr("Reason")} optional={!needsReason || reasons.length > 0} error={error || undefined} className={reasons.length ? 'sm:col-span-2' : undefined}>
          {(p) => (
            <Input
              {...p}
              value={reason}
              maxLength={160}
              onChange={(e) => {
                setReason(e.target.value)
                setError('')
              }}
              placeholder={status === 'left' ? tr("e.g. Moved to another district") : status === 'paused' ? tr("e.g. School exams until June") : tr("Optional")}
            />
          )}
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>{tr("Cancel")}</Button>
        <Button type="submit" variant={status === 'left' ? 'danger' : 'primary'}>
          {tr("Mark as")}{' '}{studentStatusLabel[status].toLowerCase()}
        </Button>
      </div>
    </form>
  )
}
