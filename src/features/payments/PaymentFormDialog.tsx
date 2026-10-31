import { useMemo, useState, type FormEvent } from 'react'
import { Info } from 'lucide-react'
import type { Payment, PaymentMethod, PaymentStatus } from '../../types'
import { PAYMENT_METHODS } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { monthKey, toISODate } from '../../lib/dates'
import { formatMonth, formatUZS, paymentMethodLabel, paymentStatusLabel } from '../../lib/format'

interface PaymentFormDialogProps {
  open: boolean
  onClose: () => void
  payment?: Payment
  /** Pre-select a student, e.g. from "Tuition overdue". */
  studentId?: string
}

export function PaymentFormDialog(props: PaymentFormDialogProps) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.payment ? 'Edit payment' : 'Record payment'}
      description="Log money the centre has already received."
    >
      {props.open && <PaymentForm {...props} />}
    </Dialog>
  )
}

interface FormState {
  studentId: string
  amount: string
  period: string
  date: string
  method: PaymentMethod
  status: PaymentStatus
  note: string
}
type Errors = Partial<Record<keyof FormState, string>>

function PaymentForm({ onClose, payment, studentId }: PaymentFormDialogProps) {
  const { data, now, balances, actions } = useSchool()
  const toast = useToast()
  const today = toISODate(now)

  const suggestedAmount = (id: string) => {
    const balance = balances.get(id)
    const student = data.students.find((s) => s.id === id)
    if (!student) return ''
    // Suggest the oldest unpaid month's tuition, or this month's.
    return String(balance && balance.owed > 0 ? Math.min(balance.owed, student.monthlyTuition) : student.monthlyTuition)
  }
  const suggestedPeriod = (id: string) => balances.get(id)?.unpaidMonths[0] ?? monthKey(now)

  const [form, setForm] = useState<FormState>(() => ({
    studentId: payment?.studentId ?? studentId ?? '',
    amount: payment ? String(payment.amount) : studentId ? suggestedAmount(studentId) : '',
    period: payment?.period ?? (studentId ? suggestedPeriod(studentId) : monthKey(now)),
    date: payment?.date ?? today,
    method: payment?.method ?? 'cash',
    status: payment?.status ?? 'paid',
    note: payment?.note ?? '',
  }))
  const [errors, setErrors] = useState<Errors>({})
  const [filter, setFilter] = useState('')

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const students = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return data.students
      .filter((s) => s.status !== 'left' || s.id === form.studentId)
      .filter((s) => !q || s.fullName.toLowerCase().includes(q) || s.id === form.studentId)
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [data.students, filter, form.studentId])

  const selected = data.students.find((s) => s.id === form.studentId)
  const balance = selected ? balances.get(selected.id) : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const e: Errors = {}
    if (!selected) e.studentId = 'Choose who paid.'
    const amount = Number(form.amount)
    if (!form.amount || !Number.isFinite(amount) || amount <= 0) e.amount = 'Enter the amount received in UZS.'
    else if (amount > 100_000_000) e.amount = 'That amount looks too large. Check the number of zeros.'
    if (!form.date) e.date = 'Choose the payment date.'
    else if (form.date > today) e.date = 'Payment date can’t be in the future.'
    if (!/^\d{4}-\d{2}$/.test(form.period)) e.period = 'Choose the tuition month this payment covers.'
    setErrors(e)
    if (Object.keys(e).length) return

    const input = {
      studentId: form.studentId,
      amount: Math.round(amount),
      period: form.period,
      date: form.date,
      method: form.method,
      status: form.status,
      note: form.note.trim() || undefined,
    }
    if (payment) {
      actions.updatePayment(payment.id, input)
      toast.show('Payment updated.')
    } else {
      actions.addPayment(input)
      toast.show(`Payment of ${formatUZS(input.amount)} recorded for ${selected!.fullName}.`)
    }
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="flex gap-2.5 rounded-control bg-info-soft px-3 py-2.5 text-sm text-info sm:col-span-2">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>This only records a payment for the demo. No money is charged or transferred. Sherov School has no payment processing.</p>
      </div>

      {!payment && !studentId && (
        <Field label="Find student" hint={`${students.length} students match`} className="sm:col-span-2">
          {(p) => <Input {...p} type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Type a name to narrow the list" autoFocus />}
        </Field>
      )}
      <Field
        label="Student"
        error={errors.studentId}
        className="sm:col-span-2"
        hint={
          balance && balance.owed > 0
            ? `Owes ${formatUZS(balance.owed)} for ${balance.unpaidMonths.map(formatMonth).join(', ')}.`
            : balance?.status === 'paid'
              ? 'No tuition owed right now.'
              : undefined
        }
      >
        {(p) => (
          <Select
            {...p}
            value={form.studentId}
            onChange={(e) => {
              const id = e.target.value
              set('studentId', id)
              if (!payment) {
                set('amount', suggestedAmount(id))
                set('period', suggestedPeriod(id))
              }
            }}
          >
            <option value="">Choose a student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
                {s.status !== 'active' ? ` (${s.status})` : ''}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Amount (UZS)" error={errors.amount} hint={Number(form.amount) > 0 ? formatUZS(Number(form.amount)) : undefined}>
        {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={10000} value={form.amount} onChange={(e) => set('amount', e.target.value)} />}
      </Field>
      <Field label="For tuition month" error={errors.period}>
        {(p) => <Input {...p} type="month" value={form.period} onChange={(e) => set('period', e.target.value)} />}
      </Field>
      <Field label="Payment date" error={errors.date}>
        {(p) => <Input {...p} type="date" max={today} value={form.date} onChange={(e) => set('date', e.target.value)} />}
      </Field>
      <Field label="Method">
        {(p) => (
          <Select {...p} value={form.method} onChange={(e) => set('method', e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {paymentMethodLabel[m]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Status" hint="Only paid payments count towards revenue and balances.">
        {(p) => (
          <Select {...p} value={form.status} onChange={(e) => set('status', e.target.value as PaymentStatus)}>
            {(Object.keys(paymentStatusLabel) as PaymentStatus[]).map((s) => (
              <option key={s} value={s}>
                {paymentStatusLabel[s]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Note" optional>
        {(p) => <Input {...p} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="e.g. Receipt #1042" />}
      </Field>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          {payment ? 'Save changes' : 'Record payment'}
        </Button>
      </div>
    </form>
  )
}
