import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, MapPin, Pencil, Phone } from 'lucide-react'
import type { Branch } from '../../types'
import { useSchool } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input } from '../../components/ui/Field'
import { formatPercent, formatPhone, formatUZSCompact, isValidPhone } from '../../lib/format'
import { branchSummaries } from '../../lib/owner'
import { cn } from '../../lib/cn'

/** Each branch: who runs it, its size and this month's numbers, and a way into its pages. */
export function OwnerBranchesPage() {
  const { owner, now } = useSchool()
  const navigate = useNavigate()
  const data = owner!.data
  const rows = useMemo(() => branchSummaries(data, now), [data, now])
  const [editing, setEditing] = useState<Branch | null>(null)

  return (
    <>
      <PageHeader title="Branches" description="Each branch is run by its administrator. Open a branch to see and change its students, groups, payments and more." />
      <ul className="grid gap-6 xl:grid-cols-3">
        {rows.map((r) => {
          const admin = data.users.find((u) => u.role === 'admin' && u.branchId === r.branch.id)
          const rooms = data.rooms.filter((x) => x.branchId === r.branch.id).length
          const openTasks = Object.values(r.tasks).reduce((s, n) => s + (n ?? 0), 0)
          return (
            <li key={r.branch.id} className="flex flex-col rounded-panel border border-line bg-surface">
              <div className="flex items-start justify-between gap-3 p-5 pb-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-ink">{r.branch.name}</h2>
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-muted">
                    <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    {r.branch.address}
                  </p>
                  <p className="num flex items-center gap-1.5 text-sm text-ink-muted">
                    <Phone aria-hidden className="size-3.5 shrink-0" />
                    {r.branch.phone}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditing(r.branch)} aria-label={`Edit ${r.branch.name} details`}>
                  <Pencil aria-hidden />
                </Button>
              </div>
              <p className="px-5 text-sm">
                <span className="text-ink-muted">Administrator: </span>
                <span className="font-medium text-ink">{admin?.fullName ?? 'None'}</span>
                {admin && <span className="text-ink-muted"> ({admin.username})</span>}
              </p>
              <dl className="num mt-4 grid grid-cols-3 gap-px border-y border-line bg-line">
                {(
                  [
                    ['Students', String(r.activeStudents)],
                    ['Teachers', String(r.activeTeachers)],
                    ['Groups', `${r.runningGroups}`],
                    ['Seats filled', r.fill === null ? '—' : formatPercent(r.fill)],
                    ['Rooms', String(rooms)],
                    ['Attendance', r.attendanceRate === null ? '—' : formatPercent(r.attendanceRate)],
                    ['Collected', formatUZSCompact(r.revenueThisMonth)],
                    ['Overdue', formatUZSCompact(r.overdue)],
                    ['Enquiries', `${r.openLeads} open`],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="bg-surface px-4 py-3">
                    <dt className="text-xs text-ink-muted">{label}</dt>
                    <dd className={cn('mt-0.5 font-semibold text-ink', label === 'Overdue' && r.overdue > 0 && 'text-danger')}>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                <span className="text-sm text-ink-muted">{openTasks ? `${openTasks} open tasks today` : 'No open tasks today'}</span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    owner!.setBranch(r.branch.id)
                    navigate('/')
                  }}
                >
                  Open {r.branch.name}
                  <ArrowRight aria-hidden />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      <BranchDialog branch={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function BranchDialog({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  return (
    <Dialog open={branch !== null} onClose={onClose} title={branch ? `${branch.name} details` : 'Branch details'} size="sm">
      {branch && <BranchForm branch={branch} onClose={onClose} />}
    </Dialog>
  )
}

function BranchForm({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const { actions } = useSchool()
  const toast = useToast()
  const [address, setAddress] = useState(branch.address)
  const [phone, setPhone] = useState(branch.phone)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const e: Record<string, string> = {}
    if (address.trim().length < 5) e.address = 'Enter the address.'
    if (!isValidPhone(phone)) e.phone = 'Enter a phone like +998 71 200 00 01.'
    setErrors(e)
    if (Object.keys(e).length) return
    actions.updateBranch(branch.id, { address, phone: formatPhone(phone) })
    toast.show(`${branch.name} details saved.`)
    onClose()
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Address" error={errors.address}>
        {(p) => <Input {...p} value={address} maxLength={120} onChange={(e) => setAddress(e.target.value)} />}
      </Field>
      <Field label="Phone" error={errors.phone}>
        {(p) => <Input {...p} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save
        </Button>
      </div>
    </form>
  )
}
