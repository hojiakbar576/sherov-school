import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CircleCheck } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { EmptyState, SearchInput, TableScroll, td, th } from '../../components/ui/misc'
import { PhoneLine } from '../../components/ui/CopyButton'
import { TuitionBadge } from '../../components/StatusBadges'
import { formatMonthShort, formatNumber, formatUZS, guardianRelationshipLabel } from '../../lib/format'
import { cn } from '../../lib/cn'
import { toISODate } from '../../lib/dates'
import { ExportButtons } from '../../components/ui/ExportButtons'
import { tr } from '../../i18n'

/**
 * Active students who still owe tuition, overdue first, with the parent's
 * phone and a one-click "Record payment". This is the list to work through.
 */
export function OwingList({ onRecordPayment }: { onRecordPayment: (studentId: string) => void }) {
  const { data, balances, now } = useSchool()
  const [q, setQ] = useState('')
  const [show, setShow] = useState<'' | 'overdue' | 'due'>('')
  const groupName = useMemo(() => new Map(data.groups.map((g) => [g.id, g.name])), [data.groups])

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    return data.students
      .map((s) => ({ s, b: balances.get(s.id) }))
      .filter(({ s, b }) => b && b.owed > 0 && (!show || b.status === show) && (!query || s.fullName.toLowerCase().includes(query) || s.guardians.some((g) => g.fullName.toLowerCase().includes(query))))
      .sort((a, b) => (a.b!.status === b.b!.status ? b.b!.owed - a.b!.owed : a.b!.status === 'overdue' ? -1 : 1))
  }, [data.students, balances, q, show])

  return (
    <section aria-label={tr("Students who haven’t paid")} className="rounded-panel border border-line bg-surface">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput label={tr("Search students who owe")} value={q} onChange={setQ} placeholder={tr("Student or parent name")} />
        <Select aria-label={tr("Which students")} value={show} onChange={(e) => setShow(e.target.value as typeof show)} className="sm:w-56">
          <option value="">{tr("Everyone who owes")}</option>
          <option value="overdue">{tr("Overdue only")}</option>
          <option value="due">{tr("Not yet due")}</option>
        </Select>
        <p className="num text-sm text-ink-muted sm:ml-auto" aria-live="polite">
          {formatNumber(rows.length)} {rows.length === 1 ? tr("student") : tr("students")} · {formatUZS(rows.reduce((sum, r) => sum + r.b!.owed, 0))}
        </p>
        <ExportButtons
          size="sm"
          name="debtors"
          date={toISODate(now)}
          disabled={rows.length === 0}
          rows={() => [
              [tr("Student"), tr("Group"), tr("Owed (UZS)"), tr("Unpaid months"), tr("Status"), tr("Parent / guardian"), tr("Relationship"), tr("Parent phone"), tr("Student phone")],
              ...rows.map(({ s, b }) => {
                const g = s.guardians[0]
                return [s.fullName, groupName.get(s.groupId ?? '') ?? '', b!.owed, b!.unpaidMonths.join(' '), b!.status, g?.fullName, g ? guardianRelationshipLabel[g.relationship] : '', g?.phone, s.phone]
              }),
            ]}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={CircleCheck} title={tr("Everyone is paid up")}>
          {tr("No active student in this list owes tuition.")}
        </EmptyState>
      ) : (
        <TableScroll>
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">{tr("Students who owe tuition, overdue first")}</caption>
            <thead className="bg-canvas">
              <tr className="border-b border-line">
                <th scope="col" className={th}>{tr("Student")}</th>
                <th scope="col" className={th}>{tr("Parent to call")}</th>
                <th scope="col" className={th}>{tr("Unpaid months")}</th>
                <th scope="col" className={cn(th, 'text-right')}>{tr("Owed")}</th>
                <th scope="col" className={th}>{tr("Status")}</th>
                <th scope="col" className={th}><span className="sr-only">{tr("Action")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ s, b }) => {
                const parent = s.guardians[0]
                return (
                  <tr key={s.id} className={cn(b!.status === 'overdue' && 'bg-danger-soft/30')}>
                    <td className={td}>
                      <Link to={`/students/${s.id}?tab=payments`} className="font-medium text-ink hover:text-brand hover:underline">
                        {s.fullName}
                      </Link>
                      <p className="text-xs text-ink-muted">{s.groupId ? groupName.get(s.groupId) : tr("No group")}</p>
                    </td>
                    <td className={cn(td, 'py-2')}>
                      {parent ? (
                        <>
                          <p className="text-ink">
                            {parent.fullName} <span className="text-xs text-ink-muted">({guardianRelationshipLabel[parent.relationship].toLowerCase()})</span>
                          </p>
                          <PhoneLine phone={parent.phone} className="text-ink-muted" />
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-ink-muted">{tr("Student’s own phone")}</p>
                          <PhoneLine phone={s.phone} className="text-ink-muted" />
                        </>
                      )}
                    </td>
                    <td className={cn(td, 'text-ink-muted')}>{b!.unpaidMonths.map(formatMonthShort).join(', ')}</td>
                    <td className={cn(td, 'num text-right font-semibold whitespace-nowrap', b!.status === 'overdue' ? 'text-danger' : 'text-ink')}>{formatUZS(b!.owed)}</td>
                    <td className={td}>
                      <TuitionBadge balance={b} />
                    </td>
                    <td className={cn(td, 'py-1.5 text-right')}>
                      <Button size="sm" onClick={() => onRecordPayment(s.id)}>
                        {tr("Record payment")}<span className="sr-only">{' '}{tr("for")}{' '}{s.fullName}</span>
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
    </section>
  )
}
