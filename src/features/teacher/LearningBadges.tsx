import { Phone } from 'lucide-react'
import type { Guardian } from '../../types'
import { Badge, type Tone } from '../../components/ui/Badge'
import { guardianRelationshipLabel, telHref } from '../../lib/format'
import { performanceLabelText, resultStatusLabel, type PerformanceLabel, type ResultStatus } from '../../lib/performance'
import { cn } from '../../lib/cn'
import { tr } from '../../i18n'

const resultTone: Record<ResultStatus, Tone> = {
  not_submitted: 'neutral',
  submitted: 'info',
  late: 'warning',
  evaluated: 'success',
}

/** Not handed in after the deadline reads as missing; before it, as still to come. */
export function ResultStatusBadge({ status, overdue }: { status: ResultStatus; overdue?: boolean }) {
  if (status === 'not_submitted' && overdue) return <Badge tone="danger">{tr("Missing")}</Badge>
  return <Badge tone={resultTone[status]}>{resultStatusLabel[status]}</Badge>
}

const labelTone: Record<PerformanceLabel, Tone> = {
  excellent: 'success',
  good: 'brand',
  needs_improvement: 'warning',
}

export function PerformanceBadge({ label }: { label: PerformanceLabel | null }) {
  if (!label) return <span className="text-sm text-ink-faint">{tr("Not enough scores yet")}</span>
  return <Badge tone={labelTone[label]}>{performanceLabelText[label]}</Badge>
}

/**
 * Parents and guardians, main contact first: name, relationship and phone.
 * Adult students without one are their own contact.
 */
export function GuardianContacts({ guardians, ownPhone, compact }: { guardians: Guardian[]; ownPhone?: string; compact?: boolean }) {
  if (guardians.length === 0) {
    if (!ownPhone) return <span className="text-sm text-ink-faint">{tr("Not provided")}</span>
    return (
      <span className="text-sm leading-snug">
        <span className="text-ink-muted">{tr("Student’s own phone")}</span>
        <a href={telHref(ownPhone)} className="num flex items-center gap-1 whitespace-nowrap text-ink-muted hover:text-ink hover:underline">
          <Phone aria-hidden className="size-3 shrink-0" />
          {ownPhone}
        </a>
      </span>
    )
  }
  return (
    <ul className={cn('space-y-1.5', compact && 'space-y-1')}>
      {guardians.map((g) => (
        <li key={g.id} className="min-w-0 text-sm leading-snug">
          <span className="text-ink">{g.fullName}</span>
          <span className="text-ink-muted">, {guardianRelationshipLabel[g.relationship].toLowerCase()}</span>
          <a href={telHref(g.phone)} className="num flex items-center gap-1 whitespace-nowrap text-ink-muted hover:text-ink hover:underline">
            <Phone aria-hidden className="size-3 shrink-0" />
            {g.phone}
          </a>
        </li>
      ))}
    </ul>
  )
}
