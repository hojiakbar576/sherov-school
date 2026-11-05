import type { AttendanceMark, Grade } from '../../../types'
import { cn } from '../../../lib/cn'
import { gradeTone } from './grade-style'
import { tr } from '../../../i18n'

export function GradeChip({ grade, size = 'md', className }: { grade: Grade; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      className={cn(
        'num inline-flex shrink-0 items-center justify-center rounded-lg font-semibold',
        size === 'sm' && 'size-6 text-xs',
        size === 'md' && 'size-8 text-sm',
        size === 'lg' && 'size-10 text-lg',
        gradeTone[grade],
        className,
      )}
    >
      {grade}
    </span>
  )
}

/** Small mark for the month grid: ✓ came, L late, ✗ absent. */
export function MarkChip({ mark }: { mark: AttendanceMark }) {
  const look = {
    present: ['bg-success-soft text-success', '✓', tr('Present')],
    late: ['bg-warning-soft text-warning', 'L', tr('Late')],
    absent: ['bg-danger-soft text-danger', '✗', tr('Absent')],
    excused: ['bg-info-soft text-info', 'E', tr('Excused')],
  }[mark]
  return (
    <span title={look[2]} className={cn('inline-flex size-7 items-center justify-center rounded-lg text-sm font-semibold', look[0])}>
      <span aria-hidden>{look[1]}</span>
      <span className="sr-only">{look[2]}</span>
    </span>
  )
}
