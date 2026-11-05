import { Building2 } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { tr } from '../../i18n'

/**
 * Owner only: which branch the administrator pages (students, payments,
 * admissions and so on) show. Owner pages always cover every branch.
 */
export function BranchSwitcher() {
  const { owner } = useSchool()
  if (!owner) return null
  return (
    <label className="mr-1 flex shrink-0 items-center gap-2 rounded-control border border-line bg-canvas py-1 pr-1 pl-2 text-sm sm:pl-2.5">
      <Building2 aria-hidden className="hidden size-4 shrink-0 text-ink-faint sm:block" />
      <span className="sr-only">{tr("Branch shown on branch pages")}</span>
      <select
        value={owner.branchId ?? ''}
        onChange={(e) => owner.setBranch(e.target.value || null)}
        className="h-8 max-w-24 cursor-pointer rounded-md bg-transparent pr-1 font-medium text-ink focus-visible:outline-2 focus-visible:outline-brand sm:max-w-none"
      >
        <option value="">{tr("All branches")}</option>
        {owner.data.branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  )
}
