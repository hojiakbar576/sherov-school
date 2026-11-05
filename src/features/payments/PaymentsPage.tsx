import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Info, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import type { Payment } from '../../types'
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
import { formatDate, formatMonth, formatNumber, formatUZS, formatUZSCompact, methodName, paymentStatusLabel } from '../../lib/format'
import { outstandingTotal, revenueInMonth } from '../../lib/metrics'
import { cn } from '../../lib/cn'
import { PaymentFormDialog } from './PaymentFormDialog'
import { OwingList } from './OwingList'
import { ExportButtons } from '../../components/ui/ExportButtons'
import { tr } from '../../i18n'

const PAGE_SIZE = 25
const FILTERS = ['q', 'month', 'method', 'status'] as const

export function PaymentsPage() {
  const { data, now, balances, actions } = useSchool()
  const toast = useToast()
  const { values, page, set, setPage, clear, active } = useListParams(FILTERS)
  const [editing, setEditing] = useState<Payment | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Payment | null>(null)
  const [payingFor, setPayingFor] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'history' || (searchParams.get('view') !== 'owing' && active) ? 'history' : 'owing'
  const setView = (v: 'owing' | 'history') =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('view', v)
        return next
      },
      { replace: true },
    )

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
  // Where each active student stands for this month's tuition.
  const tuition = { billed: 0, paid: 0, due: 0 }
  for (const s of data.students) {
    const b = balances.get(s.id)
    if (!b || b.status === 'inactive') continue
    tuition.billed += 1
    if (b.status === 'paid') tuition.paid += 1
    if (b.status === 'due') tuition.due += 1
  }
  const filteredPaid = filtered.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)

  const userName = new Map(data.users.map((u) => [u.id, u.fullName]))
  const exportRows = () => [
      [tr("Date"), tr("Student"), tr("For month"), tr("Amount (UZS)"), tr("Method"), tr("Status"), tr("Recorded by"), tr("Note")],
      ...filtered.map((p) => [p.date, student.get(p.studentId)?.fullName ?? '', p.period, p.amount, methodName(data.catalogs, p.method), paymentStatusLabel[p.status], (p.recordedBy && userName.get(p.recordedBy)) || '', p.note ?? '']),
  ]

  const rowActions = (p: Payment) => (
    <div className="flex justify-end gap-0.5">
      <Link
        to={`/payments/${p.id}/receipt`}
        aria-label={tr("Receipt {0}", p.receiptNo ?? '')}
        title={tr("Receipt and history")}
        className="inline-flex size-9 items-center justify-center rounded-control text-ink-muted hover:bg-subtle hover:text-ink"
      >
        <Receipt className="size-[18px]" />
      </Link>
      <IconButton label={tr("Edit payment")} onClick={() => setEditing(p)}>
        <Pencil />
      </IconButton>
      <IconButton label={tr("Delete payment")} onClick={() => setDeleting(p)} className="hover:bg-danger-soft hover:text-danger">
        <Trash2 />
      </IconButton>
    </div>
  )

  return (
    <>
      <PageHeader
        title={tr("Payments")}
        description={tr("Who has paid, who hasn’t, and every payment received. Recording a payment updates balances everywhere.")}
        actions={
          <>
            {/* The debtors list has its own export. */}
            {view === 'history' && (
              <ExportButtons name="payments" date={toISODate(now)} rows={exportRows} disabled={filtered.length === 0} />
            )}
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              {tr("Record payment")}
            </Button>
          </>
        }
      />

      <div className="mb-6 flex items-start gap-2.5 rounded-panel border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>{tr("This is a record-keeping demo, not a payment system. Nothing here charges a card or moves money.")}</p>
      </div>

      <dl className="mb-6 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            [tr("Collected this month"), formatUZSCompact(thisMonth.total), tr("{0} payments{1}", thisMonth.count, pending.length ? tr(", {0} transfers awaiting confirmation", pending.length) : ''), ''],
            [tr("Paid this month"), tr("{0} students", tuition.paid), tr("of {0} active students billed", tuition.billed), ''],
            [tr("Not paid yet"), tr("{0} students", tuition.due), tr("Due by the {0}th, not late yet", data.settings.tuitionDueDay), ''],
            [tr("Overdue"), formatUZSCompact(outstanding.overdueTotal), tr("{0} students past the due day", outstanding.overdueStudents), outstanding.overdueStudents ? 'text-danger' : ''],
          ] as const
        ).map(([label, value, detail, tone]) => (
          <div key={label} className="bg-surface px-5 py-4">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className={cn('num text-xl font-semibold text-ink', tone)}>{value}</dd>
            <dd className="text-xs text-ink-muted">{detail}</dd>
          </div>
        ))}
      </dl>

      <div role="tablist" aria-label={tr("Payments view")} className="mb-4 inline-flex rounded-panel border border-line bg-surface p-1">
        {(
          [
            ['owing', tr("Who hasn’t paid ({0})", outstanding.students)],
            ['history', tr("Payment history")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn('h-9 rounded-control px-4 text-sm font-medium', view === id ? 'bg-brand text-white' : 'text-ink-muted hover:bg-subtle hover:text-ink')}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'owing' && <OwingList onRecordPayment={(id) => setPayingFor(id)} />}

      {view === 'history' && (
      <section aria-label={tr("Payment history")} className="rounded-panel border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput label={tr("Search payments")} value={values.q} onChange={(v) => set('q', v)} placeholder={tr("Student name or note")} />
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <Select aria-label={tr("Filter by month")} value={values.month} onChange={(e) => set('month', e.target.value)} className="sm:w-40">
              <option value="">{tr("All months")}</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </Select>
            <Select aria-label={tr("Filter by method")} value={values.method} onChange={(e) => set('method', e.target.value)} className="sm:w-44">
              <option value="">{tr("All methods")}</option>
              {data.catalogs.paymentMethods.map((pm) => pm.id).map((m) => (
                <option key={m} value={m}>
                  {methodName(data.catalogs, m)}
                </option>
              ))}
            </Select>
            <Select aria-label={tr("Filter by status")} value={values.status} onChange={(e) => set('status', e.target.value)} className="col-span-2 sm:w-36">
              <option value="">{tr("All statuses")}</option>
              {Object.entries(paymentStatusLabel).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          {active && (
            <Button variant="ghost" size="sm" onClick={clear}>
              {tr("Clear filters")}
            </Button>
          )}
          <p className="num text-sm text-ink-muted sm:ml-auto" aria-live="polite">
            {formatNumber(filtered.length)}{' '}{tr("payments,")}{' '}{formatUZSCompact(filteredPaid)}{' '}{tr("paid")}
          </p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Receipt} title={tr("No payments match")} action={active ? <Button onClick={clear}>{tr("Clear filters")}</Button> : undefined}>
            {active ? tr("Try another month, method or name.") : tr("Recorded payments will appear here.")}
          </EmptyState>
        ) : (
          <>
            <TableScroll>
              <table className="hidden w-full text-sm md:table">
                <caption className="sr-only">{tr("Payments, newest first")}</caption>
                <thead className="bg-canvas">
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>{tr("Date")}</th>
                    <th scope="col" className={th}>{tr("Student")}</th>
                    <th scope="col" className={cn(th, 'hidden lg:table-cell')}>{tr("For month")}</th>
                    <th scope="col" className={th}>{tr("Method")}</th>
                    <th scope="col" className={cn(th, 'hidden xl:table-cell')}>{tr("Recorded by")}</th>
                    <th scope="col" className={cn(th, 'text-right')}>{tr("Amount")}</th>
                    <th scope="col" className={th}>{tr("Status")}</th>
                    <th scope="col" className={th}><span className="sr-only">{tr("Actions")}</span></th>
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
                            <Link to={`/students/${s.id}`} className="font-medium text-ink hover:text-brand hover:underline">
                              {s.fullName}
                            </Link>
                          ) : (
                            <span className="text-ink-faint">{tr("Unknown student")}</span>
                          )}
                          {p.note && <p className="text-xs text-ink-muted">{p.note}</p>}
                        </td>
                        <td className={cn(td, 'hidden text-ink-muted lg:table-cell')}>{formatMonth(p.period)}</td>
                        <td className={cn(td, 'whitespace-nowrap text-ink-muted')}>{methodName(data.catalogs, p.method)}</td>
                        <td className={cn(td, 'hidden whitespace-nowrap text-ink-muted xl:table-cell')}>{(p.recordedBy && userName.get(p.recordedBy)) || '—'}</td>
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
                    <p className="truncate font-medium text-ink">{student.get(p.studentId)?.fullName ?? tr("Unknown student")}</p>
                    <p className="text-xs text-ink-muted">
                      {formatDate(p.date)}, {methodName(data.catalogs, p.method)}
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
      )}

      <PaymentFormDialog open={payingFor !== null} studentId={payingFor ?? undefined} onClose={() => setPayingFor(null)} />
      <PaymentFormDialog open={editing !== null} payment={editing === 'new' || editing === null ? undefined : editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title={tr("Delete payment?")}
        confirmLabel={tr("Delete payment")}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          actions.deletePayment(deleting.id)
          toast.show(tr("Payment deleted."))
        }}
      >
        <p>
          {tr("The")}{' '}{deleting ? formatUZS(deleting.amount) : ''}{' '}{tr("payment from")}{' '}{student.get(deleting?.studentId ?? '')?.fullName ?? tr("this student")}{' '}{tr("on")}{' '}
          {deleting ? formatDate(deleting.date) : ''}{' '}{tr("will be removed. Their balance and this month’s revenue will be recalculated.")}
        </p>
      </ConfirmDialog>
    </>
  )
}
