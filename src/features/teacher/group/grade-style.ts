import type { Grade } from '../../../types'

/** One colour per grade, so a column of grades reads at a glance. */
export const gradeTone: Record<Grade, string> = {
  5: 'bg-success text-white',
  4: 'bg-cat-blue text-white',
  3: 'bg-warning-mark text-ink',
  2: 'bg-danger-mark text-white',
  1: 'bg-danger text-white',
}

export function formatAverage(value: number | null): string {
  return value === null ? '—' : value.toFixed(1)
}
