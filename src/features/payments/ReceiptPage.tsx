import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Printer, ReceiptText, Undo2 } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/misc'
import { PaymentStatusBadge } from '../../components/StatusBadges'
import { Logo } from '../../components/layout/Logo'
import { formatDate, formatMonth, formatRelative, formatUZS, methodName } from '../../lib/format'
import { tr } from '../../i18n'

/**
 * A payment's receipt, ready to print or save as PDF (the browser's print
 * dialog), with its correction history and a refund action.
 */
export function ReceiptPage() {
  const { paymentId } = useParams()
  const { data, now, owner } = useSchool()
  const [refunding, setRefunding] = useState(false)
  const all = owner?.data ?? data
  const payment = data.payments.find((p) => p.id === paymentId)

  if (!payment) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        <EmptyState icon={ReceiptText} title={tr("Payment not found")} action={<ButtonLink to="/payments">{tr("Back to payments")}</ButtonLink>}>
          {tr("It may have been deleted, or it belongs to another branch.")}
        </EmptyState>
      </div>
    )
  }

  const student = data.students.find((s) => s.id === payment.studentId)
  const group = data.groups.find((g) => g.id === student?.groupId)
  const branch = all.branches.find((b) => b.id === student?.branchId)
  const userName = new Map(all.users.map((u) => [u.id, u.fullName]))
  const parent = student?.guardians[0]

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/payments?view=history" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" />
          {tr("Payments")}
        </Link>
        <div className="flex gap-2">
          {payment.status !== 'refunded' && (
            <Button variant="ghost" onClick={() => setRefunding(true)}>
              <Undo2 aria-hidden />
              {tr("Refund")}
            </Button>
          )}
          <Button variant="primary" onClick={() => window.print()}>
            <Printer aria-hidden />
            {tr("Print or save as PDF")}
          </Button>
        </div>
      </div>

      <article aria-label={tr("Receipt")} className="mx-auto max-w-xl rounded-panel border border-line bg-surface p-8 print:max-w-none print:border-0 print:p-0">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <Logo />
          <div className="text-right text-sm">
            <p className="font-semibold text-ink">{tr("Receipt")}{' '}{payment.receiptNo ?? '—'}</p>
            <p className="text-ink-muted">{formatDate(payment.date)}</p>
          </div>
        </div>
        <dl className="mt-5 space-y-2.5 text-sm">
          {(
            [
              [tr("Student"), student?.fullName ?? '—'],
              [tr("Paid by"), parent ? parent.fullName : (student?.fullName ?? '—')],
              [tr("Group"), group ? `${group.name} (${group.subject})` : '—'],
              [tr("For"), tr("Tuition, {0}", formatMonth(payment.period))],
              [tr("Method"), methodName(data.catalogs, payment.method)],
              [tr("Branch"), branch ? `${branch.name}, ${branch.address}` : '—'],
              [tr("Recorded by"), payment.recordedBy ? (userName.get(payment.recordedBy) ?? '—') : '—'],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="text-right text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <span className="text-sm text-ink-muted">{tr("Amount")}</span>
          <span className="num text-2xl font-semibold text-ink">{formatUZS(payment.amount)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-ink-muted">{tr("Status")}</span>
          <PaymentStatusBadge status={payment.status} />
        </div>
        {payment.note && <p className="mt-4 rounded-control bg-subtle px-3 py-2 text-sm text-ink">{payment.note}</p>}
        <p className="mt-8 text-center text-xs text-ink-muted">
          {data.settings.centerName} · {branch?.phone ?? data.settings.phone}{tr(". A record of a payment received; not a tax invoice.")}
        </p>
      </article>

      <section aria-labelledby="history-title" className="mx-auto mt-6 max-w-xl rounded-panel border border-line bg-surface p-5 print:hidden">
        <h2 id="history-title" className="font-semibold text-ink">
          {tr("Changes to this payment")}
        </h2>
        {payment.history?.length ? (
          <ol className="mt-3 space-y-2 text-sm">
            {[...payment.history].reverse().map((h, i) => (
              <li key={i} className="border-l-2 border-line-strong pl-3">
                <p className="text-ink">{h.change}</p>
                <p className="text-xs text-ink-muted">
                  {formatRelative(h.at, now)}
                  {h.byUserId ? ` · ${userName.get(h.byUserId) ?? ''}` : ''}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">{tr("No corrections since it was recorded.")}</p>
        )}
      </section>

      <RefundDialog open={refunding} paymentId={payment.id} amount={payment.amount} onClose={() => setRefunding(false)} />
    </>
  )
}

function RefundDialog({ open, paymentId, amount, onClose }: { open: boolean; paymentId: string; amount: number; onClose: () => void }) {
  const { actions } = useSchool()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (reason.trim().length < 3) return setError('Say why the money is being returned.')
    actions.refundPayment(paymentId, reason)
    toast.show(tr("Payment marked as refunded."))
    onClose()
  }
  return (
    <Dialog open={open} onClose={onClose} title={tr("Refund this payment?")} description={tr("{0}. It stays on record as refunded and no longer counts as income.", formatUZS(amount))} size="sm">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label={tr("Reason")} error={error || undefined}>
          {(p) => <Input {...p} autoFocus value={reason} maxLength={160} onChange={(e) => setReason(e.target.value)} placeholder={tr("e.g. Paid twice by mistake")} />}
        </Field>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button onClick={onClose}>{tr("Cancel")}</Button>
          <Button type="submit" variant="danger">
            {tr("Refund")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
