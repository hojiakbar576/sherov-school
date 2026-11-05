import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, ReceiptText, Trash2 } from 'lucide-react'
import type { Expense } from '../../types'
import { useSchool } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button, IconButton } from '../../components/ui/Button'
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { EmptyState, SearchInput, TableScroll, td, th } from '../../components/ui/misc'
import { ExportButtons } from '../../components/ui/ExportButtons'
import { addMonths, isValidISODate, monthKey, toISODate } from '../../lib/dates'
import { formatDate, formatMonth, formatUZS, formatUZSCompact, listName, methodName } from '../../lib/format'
import { cn } from '../../lib/cn'
import { tr } from '../../i18n'

const FILTERS = ['q', 'month', 'category'] as const

/** Money going out: rent, utilities, marketing and the rest, by month and category. */
export function ExpensesPage() {
  const { data, now, owner, branch } = useSchool()
  const { values, set } = useListParams(FILTERS)
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Expense | null>(null)
  const toast = useToast()
  const { actions } = useSchool()
  const month = values.month || monthKey(now)
  // The owner also sees organisation-wide expenses (no branch).
  const all = owner ? owner.data.expenses.filter((e) => !owner.branchId || e.branchId === owner.branchId || e.branchId === null) : data.expenses
  const branchName = new Map((owner?.data ?? data).branches.map((b) => [b.id, b.name]))
  const months = Array.from({ length: 12 }, (_, i) => addMonths(monthKey(now), -i))

  const rows = useMemo(() => {
    const q = values.q.trim().toLowerCase()
    return all
      .filter((e) => e.date.startsWith(month) && (!values.category || e.categoryId === values.category) && (!q || e.description.toLowerCase().includes(q) || (e.paidTo ?? '').toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [all, month, values.category, values.q])

  const total = rows.reduce((s, e) => s + e.amount, 0)
  const byCategory = data.catalogs.expenseCategories
    .map((c) => ({ c, total: all.filter((e) => e.date.startsWith(month) && e.categoryId === c.id).reduce((s, e) => s + e.amount, 0) }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
  const monthTotal = byCategory.reduce((s, x) => s + x.total, 0)
  const lastMonthTotal = all.filter((e) => e.date.startsWith(addMonths(month, -1))).reduce((s, e) => s + e.amount, 0)

  return (
    <>
      <PageHeader
        title={tr("Expenses")}
        description={tr("Money going out{0}: rent, utilities, marketing and the rest. Teacher salaries are on the Salaries page.", branch ? tr(" at {0}", branch.name) : owner ? tr(" across the school") : '')}
        actions={
          <>
            <ExportButtons
              name={`expenses-${month}`}
              date={toISODate(now)}
              disabled={rows.length === 0}
              rows={() => [
                [tr("Date"), tr("Category"), tr("Description"), tr("Paid to"), tr("Branch"), tr("Method"), tr("Amount (UZS)")],
                ...rows.map((e) => [e.date, listName(data.catalogs.expenseCategories, e.categoryId), e.description, e.paidTo, e.branchId ? branchName.get(e.branchId) : 'Whole school', methodName(data.catalogs, e.method), e.amount]),
              ]}
            />
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              {tr("Add expense")}
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section aria-label={tr("Month total")} className="rounded-panel border border-line bg-surface px-5 py-4">
          <p className="text-sm text-ink-muted">{tr("Spent in")}{' '}{formatMonth(month)}</p>
          <p className="num mt-1 text-[1.75rem] font-semibold text-ink">{formatUZSCompact(monthTotal)}</p>
          <p className="text-xs text-ink-muted">{lastMonthTotal ? tr("{0} the month before", formatUZSCompact(lastMonthTotal)) : tr("Nothing recorded the month before")}</p>
        </section>
        <section aria-label={tr("By category")} className="rounded-panel border border-line bg-surface px-5 py-4">
          <p className="mb-2 text-sm text-ink-muted">{tr("By category")}</p>
          {byCategory.length === 0 ? (
            <p className="text-sm text-ink-faint">{tr("No expenses this month yet.")}</p>
          ) : (
            <ul className="space-y-1.5">
              {byCategory.map(({ c, total: t }) => (
                <li key={c.id} className="flex items-center gap-3 text-sm">
                  <button type="button" onClick={() => set('category', values.category === c.id ? '' : c.id)} className={cn('w-40 shrink-0 truncate text-left hover:underline', values.category === c.id ? 'font-medium text-brand-ink' : 'text-ink')}>
                    {c.name}
                  </button>
                  <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(t / monthTotal) * 100}%` }} />
                  </span>
                  <span className="num w-24 text-right text-ink-muted">{formatUZSCompact(t)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-label={tr("Expenses")} className="rounded-panel border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput label={tr("Search expenses")} value={values.q} onChange={(v) => set('q', v)} placeholder={tr("Description or who was paid")} />
          <Select aria-label={tr("Month")} value={month} onChange={(e) => set('month', e.target.value)} className="sm:w-44">
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </Select>
          <Select aria-label={tr("Category")} value={values.category} onChange={(e) => set('category', e.target.value)} className="sm:w-52">
            <option value="">{tr("All categories")}</option>
            {data.catalogs.expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <p className="num text-sm text-ink-muted sm:ml-auto" aria-live="polite">
            {rows.length} {rows.length === 1 ? tr("expense") : tr("expenses")} · {formatUZS(total)}
          </p>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={ReceiptText} title={tr("No expenses here")} action={<Button onClick={() => setEditing('new')}>{tr("Add expense")}</Button>}>
            {tr("Record rent, bills and purchases so the profit report is right.")}
          </EmptyState>
        ) : (
          <TableScroll>
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">{tr("Expenses for")}{' '}{formatMonth(month)}</caption>
              <thead className="bg-canvas">
                <tr className="border-b border-line">
                  <th scope="col" className={th}>{tr("Date")}</th>
                  <th scope="col" className={th}>{tr("What for")}</th>
                  <th scope="col" className={th}>{tr("Category")}</th>
                  {owner && <th scope="col" className={th}>{tr("Branch")}</th>}
                  <th scope="col" className={th}>{tr("Method")}</th>
                  <th scope="col" className={cn(th, 'text-right')}>{tr("Amount")}</th>
                  <th scope="col" className={th}><span className="sr-only">{tr("Actions")}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className={cn(td, 'num whitespace-nowrap')}>{formatDate(e.date)}</td>
                    <td className={td}>
                      <span className="block text-ink">{e.description}</span>
                      {e.paidTo && <span className="block text-xs text-ink-muted">{tr("To")}{' '}{e.paidTo}</span>}
                    </td>
                    <td className={cn(td, 'text-ink-muted')}>{listName(data.catalogs.expenseCategories, e.categoryId)}</td>
                    {owner && <td className={cn(td, 'text-ink-muted')}>{e.branchId ? branchName.get(e.branchId) : tr("Whole school")}</td>}
                    <td className={cn(td, 'text-ink-muted')}>{methodName(data.catalogs, e.method)}</td>
                    <td className={cn(td, 'num text-right font-medium whitespace-nowrap')}>{formatUZS(e.amount)}</td>
                    <td className={cn(td, 'py-1.5 text-right whitespace-nowrap')}>
                      <IconButton label={tr("Edit {0}", e.description)} onClick={() => setEditing(e)}>
                        <Pencil />
                      </IconButton>
                      <IconButton label={tr("Delete {0}", e.description)} onClick={() => setDeleting(e)} className="hover:bg-danger-soft hover:text-danger">
                        <Trash2 />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>

      <ExpenseDialog expense={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title={tr("Delete this expense?")}
        confirmLabel={tr("Delete expense")}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          actions.deleteExpense(deleting.id)
          toast.show(tr("Expense deleted."))
        }}
      >
        <p>
          {deleting?.description}, {formatUZS(deleting?.amount ?? 0)}{' '}{tr("on")}{' '}{deleting ? formatDate(deleting.date) : ''}{tr(". It will be removed from the reports. The deletion is kept in the activity history.")}
        </p>
      </ConfirmDialog>
    </>
  )
}

function ExpenseDialog({ expense, onClose }: { expense: Expense | 'new' | null; onClose: () => void }) {
  return (
    <Dialog open={expense !== null} onClose={onClose} title={expense === 'new' ? tr("Add expense") : tr("Edit expense")}>
      {expense !== null && <ExpenseForm expense={expense === 'new' ? undefined : expense} onClose={onClose} />}
    </Dialog>
  )
}

function ExpenseForm({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const { data, now, owner, branch, actions } = useSchool()
  const toast = useToast()
  const categories = data.catalogs.expenseCategories.filter((c) => c.active || c.id === expense?.categoryId)
  const methods = data.catalogs.paymentMethods.filter((m) => m.active || m.id === expense?.method)
  const [form, setForm] = useState({
    branchId: expense ? (expense.branchId ?? '') : (branch?.id ?? ''),
    categoryId: expense?.categoryId ?? categories[0]?.id ?? '',
    amount: expense ? String(expense.amount) : '',
    date: expense?.date ?? toISODate(now),
    description: expense?.description ?? '',
    paidTo: expense?.paidTo ?? '',
    method: expense?.method ?? methods[0]?.id ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const e: Record<string, string> = {}
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) e.amount = tr("Enter the amount in UZS.")
    if (!isValidISODate(form.date)) e.date = tr("Choose the date.")
    else if (form.date > toISODate(now)) e.date = tr("The date can’t be in the future.")
    if (form.description.trim().length < 3) e.description = tr("Say what it was for.")
    if (!owner && !form.branchId) e.branchId = tr("Choose a branch.")
    setErrors(e)
    if (Object.values(e).some(Boolean)) return
    const input = {
      branchId: form.branchId || null,
      categoryId: form.categoryId,
      amount: Math.round(amount),
      date: form.date,
      description: form.description.trim(),
      paidTo: form.paidTo.trim() || undefined,
      method: form.method || undefined,
    }
    if (expense) actions.updateExpense(expense.id, input)
    else actions.addExpense(input)
    toast.show(expense ? tr("Expense saved.") : tr("Expense of {0} recorded.", formatUZS(input.amount)))
    onClose()
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label={tr("What for")} error={errors.description} className="sm:col-span-2">
        {(p) => <Input {...p} autoFocus value={form.description} maxLength={120} onChange={(e) => set('description', e.target.value)} placeholder={tr("e.g. Electricity for October")} />}
      </Field>
      <Field label={tr("Category")}>
        {(p) => (
          <Select {...p} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={tr("Amount (UZS)")} error={errors.amount}>
        {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={10000} value={form.amount} onChange={(e) => set('amount', e.target.value)} />}
      </Field>
      <Field label={tr("Date")} error={errors.date}>
        {(p) => <Input {...p} type="date" max={toISODate(now)} value={form.date} onChange={(e) => set('date', e.target.value)} />}
      </Field>
      <Field label={tr("Paid with")}>
        {(p) => (
          <Select {...p} value={form.method} onChange={(e) => set('method', e.target.value)}>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={tr("Paid to")} optional>
        {(p) => <Input {...p} value={form.paidTo} maxLength={80} onChange={(e) => set('paidTo', e.target.value)} placeholder={tr("e.g. Building owner")} />}
      </Field>
      {owner && (
        <Field label={tr("Branch")} error={errors.branchId} hint={tr("Whole school = shared costs, e.g. online ads for every branch.")}>
          {(p) => (
            <Select {...p} value={form.branchId} onChange={(e) => set('branchId', e.target.value)}>
              <option value="">{tr("Whole school")}</option>
              {owner.data.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <div className="flex justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
        <Button onClick={onClose}>{tr("Cancel")}</Button>
        <Button type="submit" variant="primary">
          {expense ? tr("Save") : tr("Add expense")}
        </Button>
      </div>
    </form>
  )
}
