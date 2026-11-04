import type { LeadStage } from '../../types'
import { Badge, type Tone } from '../../components/ui/Badge'
import { leadStageLabel } from '../../lib/admissions'

const tone: Record<LeadStage, Tone> = {
  new: 'accent',
  contacted: 'neutral',
  trial_scheduled: 'info',
  trial_done: 'brand',
  enrolled: 'success',
  lost: 'neutral',
}

export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  return <Badge tone={tone[stage]}>{leadStageLabel[stage]}</Badge>
}
