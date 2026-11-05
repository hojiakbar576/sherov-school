import { KeyRound, Settings } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { ButtonLink } from '../../components/ui/Button'
import { CoursesPanel } from '../settings/CoursesAndRooms'
import { LeadStagesManager } from '../leads/LeadStagesManager'
import { tr } from '../../i18n'

/** Organisation-wide settings: courses, who runs each branch, and the demo login. */
export function OwnerSettingsPage() {
  const { owner } = useSchool()
  const data = owner!.data
  const branchName = new Map(data.branches.map((b) => [b.id, b.name]))
  const admins = data.users.filter((u) => u.role === 'admin')

  return (
    <>
      <PageHeader title={tr("Owner settings")} description={tr("Settings that apply to the whole school.")} />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <CoursesPanel />
        <div className="space-y-6">
          <Panel title={tr("Branch administrators")} description={tr("One administrator per branch. Accounts are demo accounts for now.")} flush>
            <ul className="divide-y divide-line border-t border-line">
              {admins.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span>
                    <span className="block font-medium text-ink">{a.fullName}</span>
                    <span className="block font-mono text-xs text-ink-muted">{a.username}</span>
                  </span>
                  <span className="text-ink-muted">{branchName.get(a.branchId ?? '') ?? '—'}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={tr("Centre details and demo data")}>
            <p className="text-sm text-ink-muted">{tr("The centre’s name, phone and tuition due day, and resetting the demo data, are on the shared settings page.")}</p>
            <ButtonLink to="/settings" className="mt-3">
              <Settings aria-hidden />
              {tr("Open centre settings")}
            </ButtonLink>
          </Panel>
          <Panel title={tr("Your sign-in")}>
            <div className="flex gap-3 text-sm">
              <KeyRound aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-ink-muted">
                {tr("This is a")}{' '}<span className="font-medium text-ink">{tr("temporary development login")}</span>{tr(", set in the app’s code (")}<code className="font-mono text-xs">OWNER_DEMO_CREDENTIALS</code>{' '}
                {tr("in")}{' '}<code className="font-mono text-xs">{tr("src/lib/auth.ts")}</code>{tr("). It is not secure and will be replaced by real sign-in when the school moves to a database.")}
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <Panel id="lead-stages" title={tr("Lead pipeline settings")} description={tr("The stages of the admissions board, shared by every branch. Also available as “Manage lead stages” on the Admissions page.")} className="mt-6">
        <LeadStagesManager />
      </Panel>
    </>
  )
}
