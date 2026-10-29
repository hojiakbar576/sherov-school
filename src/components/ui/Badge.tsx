import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'bg-subtle text-ink-muted',
  accent: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
}

const dots: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning-mark',
  danger: 'bg-danger',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>
      <span aria-hidden className={cn('size-1.5 rounded-full', dots[tone])} />
      {children}
    </span>
  )
}
