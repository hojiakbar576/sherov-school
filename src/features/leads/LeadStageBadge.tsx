import { useSchool } from '../../data/school-context'
import { Badge } from '../../components/ui/Badge'
import { stageColor, stageName } from '../../lib/lead-stages'

/** A stage's name in its colour, from the owner's stage list. */
export function LeadStageBadge({ stage }: { stage: string }) {
  const { data } = useSchool()
  return <Badge tone={stageColor(data.leadStages, stage)}>{stageName(data.leadStages, stage)}</Badge>
}
