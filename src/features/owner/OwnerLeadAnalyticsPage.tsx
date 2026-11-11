import { ChartNoAxesCombined } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { ButtonLink } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/misc'
import { tr } from '../../i18n'

/**
 * Placeholder for the owner's lead analytics (funnel, sources, lost reasons,
 * response speed). Not built yet: it needs call results and stage history to
 * be recorded first. The overview's "Enquiries to students" panel links here.
 */
export function OwnerLeadAnalyticsPage() {
  return (
    <>
      <PageHeader title={tr("Lead analytics")} description={tr("How enquiries turn into students, by source and branch.")} />
      <div className="rounded-panel border border-line bg-surface">
        <EmptyState
          icon={ChartNoAxesCombined}
          title={tr("Lead analytics is not built yet")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink to="/owner">{tr("Back to overview")}</ButtonLink>
              <ButtonLink to="/leads" variant="primary">
                {tr("Open admissions board")}
              </ButtonLink>
            </div>
          }
        >
          {tr("The full funnel, conversion by source, lost reasons and response speed will appear here. The overview already shows enquiries, enrolled and started for each month.")}
        </EmptyState>
      </div>
    </>
  )
}
