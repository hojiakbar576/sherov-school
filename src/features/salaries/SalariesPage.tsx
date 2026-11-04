import { useMemo, useState, type FormEvent } from 'react'
import { Banknote, Trash2 } from 'lucide-react'
import type { Teacher } from '../../types'
import { useSchool } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { Button, IconButton } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import { EmptyState, TableScroll, td, th } from '../../components/ui/misc'
import { ExportButtons } from '../../components/ui/ExportButtons'
import { addMonths, isValidISODate, monthKey, toISODate } from '../../lib/dates'
import { formatDate, formatMonth, formatUZS, methodName } from '../../lib/format'
import { salaryRuleText, teacherSalary } from '../../lib/salary'
import { cn } from '../../lib/cn'

/**
 * Teacher pay for a month: what each teacher earned (by their rule), any
 * bonus, what has been paid out, and what's still to pay.
 */
export function SalariesPage() {
  const { data, now, owner } = useSchool()
  const { values, set } = useListParams(['month'] as const)
  const [paying, setPaying] = useState<{ teacher: Teacher; remaining: number } | null>(null)
  // Pay needs every payment for the teacher's students, which the branch view has.
  const source = owner?.data ?? data
  const month = values.month || addMonths(monthKey(now), -1)
  const months = Array.from({ length: 7 }, (_, i) => addMonths(monthKey(now), -i))

  const rows = useMemo(
    () =>
      data.teachers
        .map((t) => {
          const salary = teacherSalary(source, t.id, month)
          const bonus = source.bonuses.filter((b) => b.teacherId === t.id && b.month === month).reduce((s, b) => s + b.amount, 0)
          const paid = source.salaryPayments.filter((p) => p.teacherId === t.id && p.month === month).reduce((s, p) => s + p.amount, 0)
          const due = salary.amount + bonus
          return { teacher: t, salary, bonus, due, paid, remaining: Math.max(0, due - paid) }
        })
        .filter((r) => r.due > 0 || r.paid > 0)
        .sort((a, b) => b.remaining - a.remaining || a.teacher.fullName.localeCompare(b.teacher.fullName)),
    [data.teachers, source, month],
  )
  const totals = rows.reduce((s, r) => ({ due: s.due + r.due, paid: s.paid + r.paid, remaining: s.remaining + r.remaining }), { due: 0, paid: 0, remaining: 0 })
  const payouts = source.salaryPayments.filter((p) => p.month === month && data.teachers.some((t) => t.id === p.teacherId)).sort((a, b) => b.date.localeCompare(a.date))
  const teacherName = new Map(data.teachers.map((t) => [t.id, t.fullName]))
  const userName = new Map(source.users.map((u) => [u.id, u.fullName]))
  const current = month === monthKey(now)

  return (
    <>
      <PageHeader
        title="Salaries"
        description="What each teacher earned for a month by their pay rule, plus bonuses, and what has been paid out. Change a teacher’s rule on their profile."
        actions={
          <ExportButtons
            name={`salaries-${month}`}
            date={toISODate(now)}
            disabled={rows.length === 0}
            rows={() => [
              ['Teacher', 'Pay rule', 'Tuition paid for the month', 'Share', 'Fixed', 'Bonus', 'Due', 'Paid out', 'Still to pay'],
              ...rows.map((r) => [r.teacher.fullName, salaryRuleText(r.teacher), r.salary.collected, r.salary.share, r.salary.fixed, r.bonus, r.due, r.paid, r.remaining]),
            ]}
          />
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select aria-label="Month of work" value={month} onChange={(e) => set('month', e.target.value)} className="w-52">
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonth(m)}
              {m === monthKey(now) ? ' (so far)' : ''}
            </option>
          ))}
        </Select>
        {current && <p className="text-sm text-warning">This month isn’t over: the tuition share will still grow as payments come in.</p>}
      </div>

      <dl className="num mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-panel border border-line bg-line">
        {(
          [
            ['Earned', totals.due],
            ['Paid out', totals.paid],
            ['Still to pay', totals.remaining],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="bg-surface px-5 py-4">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className={cn('mt-1 text-xl font-semibold', label === 'Still to pay' && value > 0 ? 'text-warning' : 'text-ink')}>{formatUZS(value)}</dd>
          </div>
        ))}
      </dl>

      <Panel title={`Pay for ${formatMonth(month)}`} flush>
        {rows.length === 0 ? (
          <EmptyState icon={Banknote} title="Nothing earned this month" />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-y border-line bg-canvas">
                <tr>
                  <th scope="col" className={th}>Teacher</th>
                  <th scope="col" className={cn(th, 'text-right')}>Tuition paid</th>
                  <th scope="col" className={cn(th, 'text-right')}>Share</th>
                  <th scope="col" className={cn(th, 'text-right')}>Fixed</th>
                  <th scope="col" className={cn(th, 'text-right')}>Bonus</th>
                  <th scope="col" className={cn(th, 'text-right')}>Due</th>
                  <th scope="col" className={cn(th, 'text-right')}>Paid</th>
                  <th scope="col" className={th}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.teacher.id}>
                    <td className={td}>
                      <span className="block font-medium text-ink">{r.teacher.fullName}</span>
                      <span className="block text-xs text-ink-muted">{salaryRuleText(r.teacher)}</span>
                    </td>
                    <td className={cn(td, 'num text-right text-ink-muted')}>{formatUZS(r.salary.collected)}</td>
                    <td className={cn(td, 'num text-right')}>{r.salary.share ? formatUZS(r.salary.share) : '—'}</td>
                    <td className={cn(td, 'num text-right')}>{r.salary.fixed ? formatUZS(r.salary.fixed) : '—'}</td>
                    <td className={cn(td, 'num text-right')}>{r.bonus ? formatUZS(r.bonus) : '—'}</td>
                    <td className={cn(td, 'num text-right font-semibold')}>{formatUZS(r.due)}</td>
                    <td className={cn(td, 'num text-right')}>
                      {r.remaining === 0 ? <Badge tone="success">Paid</Badge> : r.paid ? `${formatUZS(r.paid)}` : <span className="text-ink-faint">Not yet</span>}
                    </td>
                    <td className={cn(td, 'text-right')}>
                      {r.remaining > 0 && (
                        <Button size="sm" onClick={() => setPaying({ teacher: r.teacher, remaining: r.remaining })}>
                          Pay {formatUZS(r.remaining)}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      <Panel title="Payouts recorded" description={`Salary paid for ${formatMonth(month)}, newest first.`} className="mt-6" flush>
        {payouts.length === 0 ? (
          <p className="border-t border-line px-5 py-4 text-sm text-ink-muted">No payouts recorded for this month yet.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                <span className="num w-24 text-ink-muted">{formatDate(p.date)}</span>
                <span className="min-w-0 flex-1 text-ink">{teacherName.get(p.teacherId)}</span>
                <span className="text-ink-muted">
                  {methodName(source.catalogs, p.method)}
                  {p.paidBy ? ` · by ${userName.get(p.paidBy) ?? '—'}` : ''}
                  {p.note ? ` · ${p.note}` : ''}
                </span>
                <span className="num w-32 text-right font-medium">{formatUZS(p.amount)}</span>
                <DeletePayout id={p.id} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <PayDialog paying={paying} month={month} onClose={() => setPaying(null)} />
    </>
  )
}

function DeletePayout({ id }: { id: string }) {
  const { actions } = useSchool()
  const toast = useToast()
  return (
    <IconButton
      label="Remove this payout (recorded by mistake)"
      onClick={() => {
        actions.deleteSalaryPayment(id)
        toast.show('Payout removed.')
      }}
      className="hover:bg-danger-soft hover:text-danger"
    >
      <Trash2 />
    </IconButton>
  )
}

function PayDialog({ paying, month, onClose }: { paying: { teacher: Teacher; remaining: number } | null; month: string; onClose: () => void }) {
  return (
    <Dialog open={paying !== null} onClose={onClose} title="Record salary payout" description={paying ? `${paying.teacher.fullName}, for ${formatMonth(month)}` : undefined} size="sm">
      {paying && <PayForm paying={paying} month={month} onClose={onClose} />}
    </Dialog>
  )
}

function PayForm({ paying, month, onClose }: { paying: { teacher: Teacher; remaining: number }; month: string; onClose: () => void }) {
  const { data, now, actions } = useSchool()
  const toast = useToast()
  const methods = data.catalogs.paymentMethods.filter((m) => m.active)
  const [amount, setAmount] = useState(String(paying.remaining))
  const [date, setDate] = useState(toISODate(now))
  const [method, setMethod] = useState(methods.find((m) => m.id === 'transfer')?.id ?? methods[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return setError('Enter the amount paid.')
    if (!isValidISODate(date) || date > toISODate(now)) return setError('Choose today or an earlier date.')
    actions.addSalaryPayment({ teacherId: paying.teacher.id, month, amount: Math.round(n), date, method, note: note.trim() || undefined })
    toast.show(`Payout of ${formatUZS(Math.round(n))} to ${paying.teacher.fullName} recorded.`)
    onClose()
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Amount (UZS)" error={error || undefined} hint={`Still to pay: ${formatUZS(paying.remaining)}. A smaller amount records a part payment.`}>
        {(p) => <Input {...p} type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paid on">
          {(p) => <Input {...p} type="date" max={toISODate(now)} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Paid with">
          {(p) => (
            <Select {...p} value={method} onChange={(e) => setMethod(e.target.value)}>
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Note" optional>
        {(p) => <Input {...p} value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          Record payout
        </Button>
      </div>
    </form>
  )
}
