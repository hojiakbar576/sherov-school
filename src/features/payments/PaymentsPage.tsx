import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Download, Info, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import type { Payment } from '../../types'
import { PAYMENT_METHODS } from '../../types'
import { useSchool } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button, IconButton } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { EmptyState, Pagination, SearchInput, TableScroll, td, th } from '../../components/ui/misc'
import { PaymentStatusBadge } from '../../components/StatusBadges'
import { monthKey, monthKeyOf, toISODate } from '../../lib/dates'
import { formatDate, formatMonth, formatNumber, formatUZS, formatUZSCompact, paymentMethodLabel, paymentStatusLabel } from '../../lib/format'
import { outstandingTotal, revenueInMonth } from '../../lib/metrics'
import { downloadCSV } from '../../lib/csv'
import { cn } from '../../lib/cn'
import { PaymentFormDialog } from './PaymentFormDialog'

const PAGE_SIZE = 25
const FILTERS = ['q', 'month', 'method', 'status'] as const

export function PaymentsPage() {
  const { data, now, balances, actions } = useSchool()
  const toast = useToast()
  const { values, page, set, setPage, clear, active } = useListParams(FILTERS)
  const [editing, setEditing] = useState<Payment | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Payment | null>(null)

  const student = useMemo(() => new Map(data.students.map((s) => [s.id, s])), [data.students])
  const months = useMemo(() => Array.from(new Set(data.payments.map((p) => monthKeyOf(p.date)))).sort().reverse(), [data.payments])

  const filtered = useMemo(() => {
    const q = values.q.trim().toLowerCase()
    return data.payments
      .filter((p) => {
        if (q && !(student.get(p.studentId)?.fullName.toLowerCase().includes(q) || p.note?.toLowerCase().includes(q))) return false
        if (values.month && monthKeyOf(p.date) !== values.month) return false
        if (values.method && p.method !== values.method) return false
        if (values.status && p.status !== values.status) return false
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  }, [data.payments, student, values])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const thisMonth = revenueInMonth(data, monthKey(now))
  const pending = data.payments.filter((p) => p.status === 'pending')
  const outstanding = outstandingTotal(balances)
  const filteredPaid = filtered.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)

  const exportCSV = () => {
    downloadCSV(`sherov-school-payments-${toISODate(now)}.csv`, [
      ['Date', 'Student', 'For month', 'Amount (UZS)', 'Method', 'Status', 'Note'],
      ...filtered.map((p) => [p.date, student.get(p.studentId)?.fullName ?? '', p.period, p.amount, paymentMethodLabel[p.method], paymentStatusLabel[p.status], p.note ?? '']),
    ])
    toast.show(`Exported ${formatNumber(filtered.length)} payments.`, 'info')
  }

  const rowActions = (p: Payment) => (
    <div className="flex justify-end gap-0.5">
      <IconButton label="Edit payment" onClick={() => setEditing(p)}>
        <Pencil />
      </IconButton>
      <IconButton label="Delete payment" onClick={() => setDeleting(p)} className="hover:bg-danger-soft hover:text-danger">
        <Trash2 />
      </IconButton>
    </div>
  )

  return (
    <>
      <PageHeader
        title="Payments"
        description="Tuition payments received by the centre. Recording a payment updates balances and the dashboard."
        actions={
          <>
            <Button onClick={exportCSV} disabled={filtered.length === 0}>
              <Download aria-hidden />
              Export CSV
            </Button>
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              Record payment
            </Button>
          </>
        }
      />

      <div className="mb-6 flex items-start gap-2.5 rounded-panel border border-accent/20 bg-accent-soft px-4 py-3 text-sm text-accent-ink">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>This is a record-keeping demo, not a payment system. Nothing here charges a card or moves money.</p>
      </div>

      <dl className="mb-6 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3">
        {[
          ['Collected this month', formatUZSCompact(thisMonth.total), `${thisMonth.count} paid payments in ${formatMonth(monthKey(now))}`],
          ['Pending confirmation', formatUZSCompact(pending.reduce((s, p) => s + p.amount, 0)), `${pending.length} transfers not yet confirmed`],
          ['Outstanding tuition', formatUZSCompact(outstanding.total), `${outstanding.students} students owe`],
        ].map(([label, value, detail]) => (
          <div key={label} className="bg-surface px-5 py-4">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="num text-xl font-semibold text-ink">{value}</dd>
            <dd className="text-xs text-ink-muted">{detail}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Payment history" className="rounded-panel border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput label="Search payments" value={values.q} onChange={(v) => set('q', v)} placeholder="Student name or note" />
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <Select aria-label="Filter by month" value={values.month} onChange={(e) => set('month', e.target.value)} className="sm:w-40">
              <option value="">All months</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </Select>
            <Select aria-label="Filter by method" value={values.method} onChange={(e) => set('method', e.target.value)} className="sm:w-44">
              <option value="">All methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {paymentMethodLabel[m]}
                </option>
              ))}
            </Select>
            <Select aria-label="Filter by status" value={values.status} onChange={(e) => set('status', e.target.value)} className="col-span-2 sm:w-36">
              <option value="">All statuses</option>
              {Object.entries(paymentStatusLabel).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          {active && (
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear filters
            </Button>
          )}
          <p className="num text-sm text-ink-muted sm:ml-auto" aria-live="polite">
            {formatNumber(filtered.length)} payments, {formatUZSCompact(filteredPaid)} paid
          </p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments match" action={active ? <Button onClick={clear}>Clear filters</Button> : undefined}>
            {active ? 'Try another month, method or name.' : 'Recorded payments will appear here.'}
          </EmptyState>
        ) : (
          <>
            <TableScroll>
              <table className="hidden w-full text-sm md:table">
                <caption className="sr-only">Payments, newest first</caption>
                <thead className="bg-canvas">
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>Date</th>
                    <th scope="col" className={th}>Student</th>
                    <th scope="col" className={cn(th, 'hidden lg:table-cell')}>For month</th>
                    <th scope="col" className={th}>Method</th>
                    <th scope="col" className={cn(th, 'text-right')}>Amount</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={th}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((p) => {
                    const s = student.get(p.studentId)
                    return (
                      <tr key={p.id}>
                        <td className={cn(td, 'num whitespace-nowrap')}>{formatDate(p.date)}</td>
                        <td className={td}>
                          {s ? (
                            <Link to={`/students/${s.id}`} className="font-medium text-ink hover:text-accent hover:underline">
                              {s.fullName}
                            </Link>
                          ) : (
                            <span className="text-ink-faint">Unknown student</span>
                          )}
                          {p.note && <p className="text-xs text-ink-muted">{p.note}</p>}
                        </td>
                        <td className={cn(td, 'hidden text-ink-muted lg:table-cell')}>{formatMonth(p.period)}</td>
                        <td className={cn(td, 'whitespace-nowrap text-ink-muted')}>{paymentMethodLabel[p.method]}</td>
                        <td className={cn(td, 'num text-right font-medium whitespace-nowrap', p.status !== 'paid' && 'text-ink-muted')}>{formatUZS(p.amount)}</td>
                        <td className={td}>
                          <PaymentStatusBadge status={p.status} />
                        </td>
                        <td className={cn(td, 'py-1.5')}>{rowActions(p)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableScroll>
            <ul className="divide-y divide-line md:hidden">
              {visible.map((p) => (
                <li key={p.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{student.get(p.studentId)?.fullName ?? 'Unknown student'}</p>
                    <p className="text-xs text-ink-muted">
                      {formatDate(p.date)}, {paymentMethodLabel[p.method]}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="num font-semibold">{formatUZS(p.amount)}</span>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                  </div>
                  {rowActions(p)}
                </li>
              ))}
            </ul>
            <Pagination page={current} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} noun="payments" />
          </>
        )}
      </section>

      <PaymentFormDialog open={editing !== null} payment={editing === 'new' || editing === null ? undefined : editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete payment?"
        confirmLabel="Delete payment"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          actions.deletePayment(deleting.id)
          toast.show('Payment deleted.')
        }}
      >
        <p>
          The {deleting ? formatUZS(deleting.amount) : ''} payment from {student.get(deleting?.studentId ?? '')?.fullName ?? 'this student'} on{' '}
          {deleting ? formatDate(deleting.date) : ''} will be removed. Their balance and this month’s revenue will be recalculated.
        </p>
      </ConfirmDialog>
    </>
  )
}
